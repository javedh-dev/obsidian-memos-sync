import axios from "axios";
import moment from "moment";
import {
	addIcon,
	App,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
} from "obsidian";
import { findUser, OMSyncService } from "sync";
import { OMSyncPluginSettings } from "types";

const DEFAULT_SETTINGS: OMSyncPluginSettings = {
	url: "",
	token: "",
	userId: "",
	userName: "",
	notesFolder: "memos",
	attachmentsFolder: "attachments",
	lastSync: 0,
};

export default class OMSyncPlugin extends Plugin {
	settings: OMSyncPluginSettings;
	syncService: OMSyncService;
	statusBarItemEl: HTMLElement;

	async onload() {
		await this.loadSettings();

		if (
			!this.settings.url ||
			!this.settings.token ||
			!this.settings.userName
		) {
			new Notice("OM Sync: Please add config in settings");
		} else {
			this.syncService = new OMSyncService(this.settings, this.app.vault);
			this.statusBarItemEl = this.addStatusBarItem();
			this.refreshStatusBar();
			this.updateUser();

			this.addRibbonIcon("feather", "Sync Memos", (evt: MouseEvent) => {
				this.performSync();
			});

			this.addCommand({
				id: "sync-memos",
				name: "Sync Memos",
				callback: () => {
					this.performSync();
				},
			});
		}

		this.addSettingTab(new OMSyncSettingTab(this.app, this));
	}
	async updateUser() {
		if (this.settings.userId == "") {
			findUser(this.settings)
				.then((response) => {
					const users = response.data.users;
					if (users.length != 1) {
						new Notice("OM Sync :Invalid Username.!!!");
					} else {
						this.settings.userId = `users/${users[0].id}`;
						this.saveSettings();
					}
				})
				.catch((error) => {
					console.error("OM Sync : ", error);
				});
		}
	}

	async performSync() {
		new Notice("OM Sync: Started syncing...");
		await this.syncService.syncData();
		this.saveSettings();
		this.refreshStatusBar();
		new Notice("OM Sync: Synced successfully!!!");
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData(),
		);
	}

	async refreshStatusBar() {
		this.statusBarItemEl.setText(
			`OM Sync: Synced ${moment(new Date(this.settings.lastSync)).fromNow()}`,
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class OMSyncSettingTab extends PluginSettingTab {
	plugin: OMSyncPlugin;

	constructor(app: App, plugin: OMSyncPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName("URL")
			.setDesc("URL of the memos instance")
			.addText((text) =>
				text
					.setPlaceholder("https://memos.example.tld")
					.setValue(this.plugin.settings.url)
					.onChange(async (value) => {
						this.plugin.settings.url = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Token")
			.setDesc("Generated token to access memos instance")
			.addText((text) =>
				text
					.setPlaceholder("eyJhbGciOi...")
					.setValue(this.plugin.settings.token)
					.onChange(async (value) => {
						this.plugin.settings.token = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Username")
			.setDesc("Username of the user with token defined above")
			.addText((text) =>
				text
					.setPlaceholder("john-doe")
					.setValue(this.plugin.settings.userName)
					.onChange(async (value) => {
						this.plugin.settings.userName = value;
						await this.plugin.updateUser();
					}),
			);

		new Setting(containerEl)
			.setName("Notes Folder")
			.setDesc("The folder where all memos will be saved")
			.addText((text) =>
				text
					.setPlaceholder(DEFAULT_SETTINGS.notesFolder)
					.setValue(this.plugin.settings.notesFolder)
					.onChange(async (value) => {
						this.plugin.settings.notesFolder = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Attachments Folder")
			.setDesc("The folder where all attachments will be saved")
			.addText((text) =>
				text
					.setPlaceholder(DEFAULT_SETTINGS.attachmentsFolder)
					.setValue(this.plugin.settings.attachmentsFolder)
					.onChange(async (value) => {
						this.plugin.settings.attachmentsFolder = value;
						await this.plugin.saveSettings();
					}),
			);
	}
}
