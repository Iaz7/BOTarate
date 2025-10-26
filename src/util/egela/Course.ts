import { CourseSection } from "./CourseSection";

export { Course }

class Course {
    id: string;
    //numSections: number;
    baseUrl: string;
    highlighted: string;
    //editMode: boolean;
    sections: CourseSection[];
    //stateKey: string;

    constructor(data: any) {
        const courseInfo = data.course;
        this.id = courseInfo.id;
        //this.numSections = courseInfo.numsections;
        this.baseUrl = courseInfo.baseurl;
        this.highlighted = courseInfo.highlighted;
        //this.editMode = courseInfo.editmode;
        //this.stateKey = courseInfo.statekey;

        this.sections = data.section.map((sectionData: any) =>
            new CourseSection(sectionData, data.cm, this.baseUrl)
        );
    }

    getSectionById(sectionId: string): CourseSection | undefined {
        return this.sections.find(section => section.id === sectionId);
    }

    getSectionByNumber(sectionNumber: number): CourseSection | undefined {
        return this.sections.find(section => section.section === sectionNumber);
    }

    /*getVisibleSections(): CourseSection[] {
        return this.sections.filter(section => section.visible);
    }*/

    getAllDownloadableResources() {
        const allResources = [];
        for (const section of this.sections) {
            allResources.push(...section.getDownloadableResources());
        }
        return allResources;
    }

    getSectionsWithResources(): CourseSection[] {
        return this.sections.filter(section => section.hasResources());
    }

    getCourseUrl(): string {
        return this.baseUrl;
    }
}