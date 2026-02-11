import { parseHTML } from 'linkedom';
import { checkTeacherStatus } from './common';

export interface EgelaCourseInfo {
    id: string;
    name: string;
}

/**
 * Fetches the user's course list from the eGela dashboard.
 * Must be called from the background service worker (fetch with cookies).
 * @returns Array of course IDs and names, or throws on error / session expired.
 */
export async function getUserCourses(): Promise<EgelaCourseInfo[]> {
    const url = 'https://egela.ehu.eus/';

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`[getUserCourses] HTTP error: ${response.status}`);
    }

    // Detect session expired (redirect to login)
    if (response.url?.includes('egela.ehu.eus/login/index.php')) {
        throw new Error('EgelaSessionExpired');
    }

    const html = await response.text();
    const { document: doc } = parseHTML(html);

    // Select all dashboard cards with data-course-id
    const cards = doc.querySelectorAll('.dashboard-card[data-course-id]');

    const courses: EgelaCourseInfo[] = Array.from(cards).map((el: any) => {
        const id = el.getAttribute('data-course-id') || '';
        // Try to get the course name from the card
        const nameEl = el.querySelector('.multiline .coursename') ||
            el.querySelector('.coursename') ||
            el.querySelector('.course-card-name') ||
            el.querySelector('[data-type="1"]');
        const name = nameEl?.textContent?.trim() || `Curso ${id}`;
        return { id, name };
    });

    return courses;
}

/**
 * Checks if the current user is a teacher in the given course.
 * Standalone function that doesn't require a full Course object.
 * @param courseId The course ID to check
 * @returns true if the user is a teacher in this course
 */
export async function isUserTeacherInCourse(courseId: string): Promise<boolean> {
    const result = await checkTeacherStatus(courseId);
    return result.isTeacher;
}
