import { CourseResource } from "./CourseResource";

export { CourseSection };

class CourseSection {
    id: string;
    section: number;
    title: string;
    //visible: boolean;
    //current: boolean; // If this is the currently active section
    //hasSummary: boolean;
    //hasRestrictions: boolean;
    //resourceIds: string[]; // IDs of resources in this section (cmlist)
    resources: CourseResource[]; // Actual resource objects
    //baseUrl: string; // For constructing section URL

    constructor(sectionData: any, allResources: any[], courseBaseUrl: string) {
        this.id = sectionData.id;
        this.section = sectionData.section;
        this.title = sectionData.title;
        //this.visible = sectionData.visible;
        /*this.current = sectionData.current;
        this.hasSummary = sectionData.hassummary;
        this.hasRestrictions = sectionData.hasrestrictions;
        this.resourceIds = ;
        this.baseUrl = courseBaseUrl;*/

        const resourceIds: string[] = sectionData.cmlist || [];
        this.resources = resourceIds
            .map(resourceId => allResources.find(resource => resource.id === resourceId))
            .filter(resource => resource !== undefined)
            .map(resource => new CourseResource(resource));
    }

    /*getSectionUrl(): string {
        return `${this.baseUrl}&section=${this.sectionNumber}`;
    }*/

    getDownloadableResources(): CourseResource[] {
        return this.resources.filter(resource => resource.isDownloadable());
    }

    getResourcesByType(type: string): CourseResource[] {
        return this.resources.filter(resource => resource.module === type);
    }

    hasResources(): boolean {
        return this.resources.length > 0;
    }
}