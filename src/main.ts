import moment from "moment";
import {
	addIcon,
	App,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
} from "obsidian";
import { OMSyncService } from "sync";
import { OMSyncPluginSettings } from "types";

const DEFAULT_SETTINGS: OMSyncPluginSettings = {
	url: "",
	token: "",
	userId: "",
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
		this.syncService = new OMSyncService(this.settings, this.app.vault);
		this.statusBarItemEl = this.addStatusBarItem();
		this.refreshStatusBar();

		this.addRibbonIcon(
			"refresh-ccw-dot",
			"Sync Memos",
			(evt: MouseEvent) => {
				this.performSync();
			},
		);

		this.addCommand({
			id: "sync-memos",
			name: "Sync Memos",
			callback: () => {
				this.performSync();
			},
		});

		this.addSettingTab(new OMSyncSettingTab(this.app, this));
	}

	async performSync() {
		new Notice("Starting Memos Sync...");
		await this.syncService.syncData();
		this.saveSettings();
		this.refreshStatusBar();
		new Notice("Memos Sync completed!");
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
			`Memos Synced: ${moment(new Date(this.settings.lastSync)).fromNow()}`,
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
			.setName("User Id")
			.setDesc("The Id of the user with token defined above")
			.addText((text) =>
				text
					.setPlaceholder("users/{uid}")
					.setValue(this.plugin.settings.userId)
					.onChange(async (value) => {
						this.plugin.settings.userId = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Memos Folder")
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
