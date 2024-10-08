import tasks = require('azure-pipelines-task-lib/task');
import {ToolRunner} from 'azure-pipelines-task-lib/toolrunner';
import {TerraformAuthorizationCommandInitializer} from './terraform-commands';
import {BaseTerraformCommandHandler} from './base-terraform-command-handler';
import path = require('path');
import * as uuidV5 from 'uuid/v5';

export class TerraformCommandHandlerGCP extends BaseTerraformCommandHandler {
    constructor() {
        super();
        this.providerName = "gcp";
    }

    private getJsonKeyFilePath(serviceName: string) {
        // Get credentials for json file
        const jsonKeyFilePath = path.resolve(`credentials-${uuidV5(serviceName, uuidV5.URL)}.json`);

        let clientEmail = tasks.getEndpointAuthorizationParameter(serviceName, "Issuer", false);
        let tokenUri = tasks.getEndpointAuthorizationParameter(serviceName, "Audience", false);
        let privateKey = tasks.getEndpointAuthorizationParameter(serviceName, "PrivateKey", false);

        // Create json string and write it to the file
        let jsonCredsString = `{"type": "service_account", "private_key": "${privateKey}", "client_email": "${clientEmail}", "token_uri": "${tokenUri}"}`
        tasks.writeFile(jsonKeyFilePath, jsonCredsString);

        return jsonKeyFilePath;
    }

    private setupBackend(backendServiceName: string) {
        this.backendConfig.set('bucket', tasks.getInput("backendGCPBucketName", true));
        this.backendConfig.set('prefix', tasks.getInput("backendGCPPrefix", false));

        let jsonKeyFilePath = this.getJsonKeyFilePath(backendServiceName);

        this.backendConfig.set('credentials', jsonKeyFilePath);
    }

    public async handleBackend(terraformToolRunner: ToolRunner) : Promise<void> {
        tasks.debug('Setting up backend GCP.');
        let backendServiceName = tasks.getInput("backendServiceGCP", true);
        this.setupBackend(backendServiceName);

        for (let [key, value] of this.backendConfig.entries()) {
            terraformToolRunner.arg(`-backend-config=${key}=${value}`);
        }
        tasks.debug('Finished setting up backend GCP.');
    }

    public async handleProvider(command: TerraformAuthorizationCommandInitializer) : Promise<void> {
        if (command.serviceProvidername) {
            let jsonKeyFilePath = this.getJsonKeyFilePath(command.serviceProvidername);

            process.env['GOOGLE_CREDENTIALS']  = `${jsonKeyFilePath}`;
            process.env['GOOGLE_PROJECT']  = tasks.getEndpointDataParameter(command.serviceProvidername, "project", false);            
        }
    }
}