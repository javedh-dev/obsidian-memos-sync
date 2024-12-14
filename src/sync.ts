import axios, { AxiosRequestConfig } from "axios";
import {
	Memo,
	MemosResponse,
	OMSyncPluginSettings,
	Resource,
	ResourcesResponse,
} from "types";
import mime from "mime";
import { TFile, Vault } from "obsidian";
import { createHash } from "crypto";

export class OMSyncService {
	settings: OMSyncPluginSettings;
	vault: Vault;

	constructor(settings: OMSyncPluginSettings, vault: Vault) {
		this.settings = settings;
		this.vault = vault;
	}

	public async syncData() {
		await this.syncMemos();
		await this.syncResources();
		this.settings.lastSync = Date.now();
	}
	private async syncMemos(pageToken = "") {
		const options: AxiosRequestConfig = {
			method: "GET",
			url: `${this.settings.url}/api/v1/memos`,
			headers: {
				Authorization: `Bearer ${this.settings.token}`,
			},
			params: {
				pageSize: 50,
				pageToken: pageToken,
				filter: `creator=='${this.settings.userId}'`,
			},
		};
		try {
			const response = await axios.request<MemosResponse>(options);
			const fetchNext = await this.filterAndPersistMemos(
				response.data.memos,
			);
			if (fetchNext && response.data.nextPageToken != "") {
				this.syncMemos(response.data.nextPageToken);
			}
		} catch (error) {
			console.error("Error:", error);
		}
	}

	private async filterAndPersistMemos(memos: Memo[]): Promise<boolean> {
		console.log("Memos : ", memos);
		memos = memos.filter((memo) => {
			const resourceDate = new Date(Date.parse(memo.updateTime));
			const lastSyncDate = new Date(this.settings.lastSync);
			return resourceDate > lastSyncDate;
		});
		for (const memo of memos) {
			const memoContent = memo.content;
			const fileName = memo.name.replace("/", "-");
			await this.persistMdFile(fileName, memoContent);
		}
		return memos.length != 0;
	}

	private async persistMdFile(fileName: string, memoContent: string) {
		const filePath = `${this.settings.notesFolder}/${fileName}.md`;
		await this.vault.create(filePath, memoContent);
	}

	private async syncResources() {
		const options: AxiosRequestConfig = {
			method: "GET",
			url: `${this.settings.url}/api/v1/resources`,
			headers: {
				Authorization: `Bearer ${this.settings.token}`,
			},
		};
		try {
			const response = await axios.request<ResourcesResponse>(options);
			await this.filterAndPersistResources(response.data.resources);
		} catch (error) {
			console.error("Error:", error);
		}
	}

	private async filterAndPersistResources(resources: Resource[]) {
		resources = resources.filter((res) => {
			const resourceDate = new Date(Date.parse(res.createTime));
			const lastSyncDate = new Date(this.settings.lastSync);
			return resourceDate > lastSyncDate;
		});
		console.log("Resources : ", resources);
		for (const resource of resources) {
			const fileData = await this.readFileData(resource);
			const fileName = this.getFileName(resource);
			const persistedFile = await this.persistBinaryFile(
				fileName,
				fileData.data,
			);
			if (resource.memo != "") {
				await this.attachToMemo(resource.memo, persistedFile);
			}
		}
	}
	private async attachToMemo(memo: string, persistedFile: TFile) {
		const memoPath = `${this.settings.notesFolder}/${memo.replace("/", "-")}.md`;
		const memoFile = this.vault.getFileByPath(memoPath);
		if (!memoFile) {
			console.error("Couldn't find memo at given path : ", memoPath);
		} else {
			await this.vault.append(memoFile, `\n\n![[${persistedFile.name}]]`);
		}
	}

	private async persistBinaryFile(
		fileName: string,
		fileData: ArrayBuffer,
	): Promise<TFile> {
		const filePath = `${this.settings.attachmentsFolder}/${fileName}`;
		return await this.vault.createBinary(filePath, fileData);
	}

	private async readFileData(resource: Resource) {
		return await axios.get(`${this.settings.url}/file/${resource.name}/`, {
			headers: {
				Authorization: `Bearer ${this.settings.token}`,
			},
			responseType: "arraybuffer",
		});
	}

	private getFileName(resource: Resource) {
		let fname = "";
		if (resource.filename) {
			fname = resource.filename.split(".")[0];
		} else if (resource.name) {
			fname = resource.name.replace("/", "-");
		}
		return `${fname}-${this.hashFunction(resource.createTime)}.${mime.getExtension(resource.type)}`;
	}

	private hashFunction(input: string): string {
		const hash = createHash("md5").update(input).digest("hex");
		return hash.substring(0, 5);
	}
}
