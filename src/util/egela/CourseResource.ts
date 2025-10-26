export { CourseResource }

class CourseResource {
    id: string;
    name: string;
    module: string; // forum, resource, label, url, wiki, assign, etc.
    //plugin: string; // mod_forum, mod_resource, etc.
    //url?: string; // Some resources don't have URLs (like labels)
    //visible: boolean;
    sectionId: string;
    //sectionNumber: number;
    //indent: number; // For hierarchical display
    //userVisible: boolean;
    //accessVisible: boolean;

    constructor(data: any) {
        this.id = data.id;
        this.name = data.name;
        this.module = data.module;
        //this.plugin = data.plugin;
        //this.url = data.url;
        //this.visible = data.visible;
        this.sectionId = data.sectionid;
        //this.sectionNumber = data.sectionnumber;
        //this.indent = data.indent || 0;
        //this.userVisible = data.uservisible;
        //this.accessVisible = data.accessvisible;
    }

    isDownloadable(): boolean {
        return this.module === 'resource' /*&& this.url !== undefined*/;
    }

    isForum(): boolean {
        return this.module === 'forum';
    }

    /*isUrl(): boolean {
        return this.module === 'url';
    }*/

    isLabel(): boolean {
        return this.module === 'label';
    }
}