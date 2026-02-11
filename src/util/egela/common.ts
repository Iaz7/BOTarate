import { parseHTML } from 'linkedom';

/**
 * Interface for teacher role detection result
 */
export interface TeacherRoleCheckResult {
    isTeacher: boolean;
    userEmail: string;
}

/**
 * List of role names that identify a teacher/instructor
 */
export const TEACHER_ROLES = [
    'Teacher',
    'Profesor',
    'Irakaslea',
    'Docente',
    'Eskuz matrikulatutako ikaslea', // TODO: Remove these test roles
    'Estudiante manual',
    'Manual enrollment student'
];

/**
 * Gets the current user's email from their profile page
 * @returns The current user's email
 * @throws Error if profile cannot be fetched or email cannot be extracted
 */
export async function getCurrentUserEmail(): Promise<string> {
    const profileUrl = 'https://egela.ehu.eus/user/profile.php';
    const profileResponse = await fetch(profileUrl);

    if (!profileResponse.ok) {
        throw new Error(`[getCurrentUserEmail] Error fetching profile: ${profileResponse.status}`);
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
        throw new Error('[getCurrentUserEmail] Could not get current user email');
    }

    const currentUserEmail = emailElement.textContent?.trim();

    if (!currentUserEmail) {
        throw new Error('[getCurrentUserEmail] Current user email is empty');
    }

    return currentUserEmail;
}

/**
 * Checks if the current user is a teacher in the given course
 * Optimized to check role first before fetching profiles
 * @param courseId The course ID to check
 * @returns Object with isTeacher flag and the current user's email
 */
export async function checkTeacherStatus(courseId: string): Promise<TeacherRoleCheckResult> {
    // 1. Get current user's email
    const currentUserEmail = await getCurrentUserEmail();

    // 2. Get course participants (requesting up to 5000 per page to avoid pagination)
    const participantsUrl = `https://egela.ehu.eus/user/index.php?page=0&perpage=5000&contextid=0&id=${courseId}&newcourse`;
    const participantsResponse = await fetch(participantsUrl);

    if (!participantsResponse.ok) {
        throw new Error(`[checkTeacherStatus] Error fetching participants: ${participantsResponse.status}`);
    }

    if (participantsResponse.url?.includes('egela.ehu.eus/login/index.php')) {
        throw new Error('EgelaSessionExpired');
    }

    const participantsHtml = await participantsResponse.text();
    const { document: participantsDoc } = parseHTML(participantsHtml);

    // 3. Find current user in participants and check role
    let userIndex = 0;
    while (true) {
        const userNameCellId = `user-index-participants-${courseId}_r${userIndex}_c1`;
        const userNameCell = participantsDoc.querySelector(`#${userNameCellId}`);

        if (!userNameCell) {
            // No more users - current user is not a teacher
            return {
                isTeacher: false,
                userEmail: currentUserEmail
            };
        }

        // 1. Check the role first (before fetching the profile)
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
            throw new Error(`[checkTeacherStatus] Could not get role for user record at index ${userIndex}`);
        }

        const isTeacherRole = TEACHER_ROLES.includes(role);

        if (!isTeacherRole) {
            // If not a teacher role, skip this user without fetching their profile
            userIndex++;
            continue;
        }

        // 2. If it is a teacher role, fetch the profile to see if it's the current user
        console.log(`[checkTeacherStatus] Potential teacher found (role: ${role}), checking email...`);

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
            console.log(`[checkTeacherStatus] Current user confirmed as teacher: ${currentUserEmail}`);
            return {
                isTeacher: true,
                userEmail: currentUserEmail
            };
        }

        userIndex++;
    }
}
