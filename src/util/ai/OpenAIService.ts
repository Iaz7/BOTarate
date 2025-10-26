import OpenAI from "openai";

export { OpenAIService }

import { AIProvider, ConfigManager } from "../config/ConfigManager";

class OpenAIService {

    static openai: OpenAI = new OpenAI({
        apiKey: ConfigManager.getSelectedProvider().key,
        baseURL: ConfigManager.getSelectedProvider().baseUrl,
        dangerouslyAllowBrowser: true
    });

    static loadProviderConfig(): void {
        this.openai.apiKey = ConfigManager.getSelectedProvider().key;
        this.openai.baseURL = ConfigManager.getSelectedProvider().baseUrl;
    }

    // Gets model list from the specified provider, or from the selected provider by default 
    static async getModelList(provider: AIProvider | undefined = undefined): Promise<string[]> {
        if (provider != undefined) {
            this.openai.baseURL = provider?.baseUrl;
            this.openai.apiKey = provider?.key;
        }

        const list = await this.openai.models.list();

        let modelList: string[] = [];
        for await (const model of list) {
            modelList.push(model.id);
        }
        console.log(this.openai.baseURL);
        console.log(modelList);

        this.loadProviderConfig(); // Restore selected provider
        return modelList;
    }

    static async generateResponse(prompt: string): Promise<string> {
        this.loadProviderConfig();
        console.log("Url: " + ConfigManager.getSelectedProvider().baseUrl);
        console.log("Model: " + ConfigManager.getSelectedModel());

        const response = await this.openai.chat.completions.create({
            model: ConfigManager.getSelectedModel(),
            messages: [
                {
                    role: "user",
                    content: prompt
                }
            ],
            max_tokens: 4096
        });
        return response.choices[0]?.message?.content || "";
    }
}
