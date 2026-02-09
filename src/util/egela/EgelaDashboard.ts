import { parseHTML } from 'linkedom';

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
    // 1. Get current user's email from profile
    const profileUrl = 'https://egela.ehu.eus/user/profile.php';
    const profileResponse = await fetch(profileUrl);
    if (!profileResponse.ok) {
        throw new Error(`[isUserTeacherInCourse] Error fetching profile: ${profileResponse.status}`);
    }
    if (profileResponse.url?.includes('egela.ehu.eus/login/index.php')) {
        throw new Error('EgelaSessionExpired');
    }
    const profileHtml = await profileResponse.text();
    const { document: profileDoc } = parseHTML(profileHtml);

    const emailElement = profileDoc.querySelector(
        '#region-main-box > div > div.col-md-4 > div > div.userinfo.my-2 > ul > li > dl > dd > a'
    );
    if (!emailElement) {
        throw new Error('[isUserTeacherInCourse] Could not get current user email');
    }
    const currentUserEmail = emailElement.textContent?.trim();
    if (!currentUserEmail) {
        throw new Error('[isUserTeacherInCourse] Current user email is empty');
    }

    // 2. Get course participants
    const participantsUrl = `https://egela.ehu.eus/user/index.php?id=${courseId}`;
    const participantsResponse = await fetch(participantsUrl);
    if (!participantsResponse.ok) {
        throw new Error(`[isUserTeacherInCourse] Error fetching participants: ${participantsResponse.status}`);
    }
    if (participantsResponse.url?.includes('egela.ehu.eus/login/index.php')) {
        throw new Error('EgelaSessionExpired');
    }
    const participantsHtml = await participantsResponse.text();
    const { document: participantsDoc } = parseHTML(participantsHtml);

    // 3. Find current user in participants list and check role
    let userIndex = 0;
    while (true) {
        const userNameCellId = `user-index-participants-${courseId}_r${userIndex}_c1`;
        const userNameCell = participantsDoc.querySelector(`#${userNameCellId}`);

        if (!userNameCell) {
            // No more users
            throw new Error(`[isUserTeacherInCourse] User ${currentUserEmail} not found in participants`);
        }

        const userProfileLink = userNameCell.querySelector('a');
        if (!userProfileLink) {
            userIndex++;
            continue;
        }

        const userProfileUrl = userProfileLink.getAttribute('href');
        if (!userProfileUrl) {
            userIndex++;
            continue;
        }

        const userProfileResponse = await fetch(userProfileUrl);
        if (!userProfileResponse.ok) {
            userIndex++;
            continue;
        }
        if (userProfileResponse.url?.includes('egela.ehu.eus/login/index.php')) {
            throw new Error('EgelaSessionExpired');
        }
        const userProfileHtml = await userProfileResponse.text();
        const { document: userProfileDoc } = parseHTML(userProfileHtml);

        const userEmailElement = userProfileDoc.querySelector(
            '#region-main-box > div > div.col-md-4 > div > div.userinfo.my-2 > ul > li > dl > dd > a'
        );
        const userEmail = userEmailElement?.textContent?.trim();

        if (userEmail === currentUserEmail) {
            const userRoleCellIdWithSpan = `user-index-participants-${courseId}_r${userIndex}_c3 > span > a`;
            const userRoleCellWithSpan = participantsDoc.querySelector(`#${userRoleCellIdWithSpan}`);

            const userRoleCellId = `user-index-participants-${courseId}_r${userIndex}_c2`;
            const userRoleCell = participantsDoc.querySelector(`#${userRoleCellId}`);

            let role = '';

            if (userRoleCellWithSpan) {
                role = userRoleCellWithSpan.textContent?.trim() || '';
            } else if (userRoleCell) {
                role = userRoleCell.textContent?.trim() || '';
            } else {
                throw new Error(`[isUserTeacherInCourse] Could not get role for user ${currentUserEmail}`);
            }

            const isTeacher = [
                'Teacher', 'Profesor', 'Irakaslea', 'Docente',
                'Eskuz matrikulatutako ikaslea', 'Estudiante manual', 'Manual enrollment student'
            ].includes(role);
            return isTeacher;
        }

        userIndex++;
    }
}
