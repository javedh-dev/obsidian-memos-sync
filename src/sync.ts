import axios, { AxiosRequestConfig, AxiosResponse } from "axios";
import {
	Memo,
	MemosResponse,
	OMSyncPluginSettings,
	Resource,
	ResourcesResponse,
	User,
	UsersResponse,
} from "types";
import mime from "mime";
import { TFile, Vault } from "obsidian";

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
			console.error("OM Sync: ", error);
		}
	}

	private async filterAndPersistMemos(memos: Memo[]): Promise<boolean> {
		memos = memos.filter((memo) => {
			const resourceDate = new Date(Date.parse(memo.updateTime));
			const lastSyncDate = new Date(this.settings.lastSync);
			return resourceDate > lastSyncDate;
		});
		console.log("OM Sync: Memos ", memos);
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
			console.error("OM Sync: ", error);
		}
	}

	private async filterAndPersistResources(resources: Resource[]) {
		resources = resources.filter((res) => {
			const resourceDate = new Date(Date.parse(res.createTime));
			const lastSyncDate = new Date(this.settings.lastSync);
			return resourceDate > lastSyncDate;
		});
		console.log("OM Sync: Resources ", resources);
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
			console.error(
				"OM Sync: Couldn't find memo at given path - ",
				memoPath,
			);
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
		let hash = 0;
		for (let i = 0; i < input.length; i++) {
			hash = (hash << 5) - hash + input.charCodeAt(i);
			hash = hash | 0; // Convert to 32bit integer
		}
		return Math.abs(hash).toString(36).substring(0, 5);
	}
}

export const findUser = (
	settings: OMSyncPluginSettings,
): Promise<AxiosResponse<UsersResponse>> => {
	return axios.get<UsersResponse>(`${settings.url}/api/v1/users:search`, {
		headers: {
			Authorization: `Bearer ${settings.token}`,
		},
		params: {
			filter: `username=='${settings.userName}'`,
		},
	});
};
