export interface OMSyncPluginSettings {
	url: string;
	token: string;
	userId: string;
	userName: string;
	notesFolder: string;
	attachmentsFolder: string;
	lastSync: number;
}

export interface Resource {
	uid: string;
	name: string;
	filename: string;
	createTime: string;
	memo: string;
	type: string;
}

export interface Memo {
	uid: string;
	name: string;
	content: string;
	updateTime: string;
	memo: string;
	type: string;
}

export interface User {
	name: string;
	id: number;
}

export interface UsersResponse {
	users: User[];
}

export interface MemosResponse {
	memos: Memo[];
	nextPageToken: string;
}

export interface ResourcesResponse {
	resources: Resource[];
}
