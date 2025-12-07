import { parseHTML } from 'linkedom';
import { CourseSection } from "./CourseSection";
import { FileData, FileManager } from "./FileManager";
import { PageParser } from "./PageParser";
import { SectionParser } from "./SectionParser";

export { Course };

/**
 * Función auxiliar para obtener el HTML de una sección
 * Puede ser llamada directamente o a través de chrome.runtime.sendMessage
 */
export async function fetchSectionHtml(courseId: string, sectionNumber: number): Promise<string> {
    const url = `https://egela.ehu.eus/course/view.php?id=${courseId}&section=${sectionNumber}`;

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.text();
}

/**
 * Función auxiliar para obtener el HTML de una página
 */
export async function fetchPageHtml(pageId: string): Promise<string> {
    const url = `https://egela.ehu.eus/mod/page/view.php?id=${pageId}`;

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.text();
}

class Course {
    id: string;
    baseUrl: string;
    highlighted: string;
    sections: CourseSection[];

    constructor(data: any) {
        const courseInfo = data.course;
        this.id = courseInfo.id;
        this.baseUrl = courseInfo.baseurl;
        this.highlighted = courseInfo.highlighted;

        this.sections = data.section.map((sectionData: any) =>
            new CourseSection(sectionData, data.cm, this.baseUrl)
        );
    }

    /**
     * Crea una instancia de Course desde un href y el sessionStorage
     * @param href URL actual de la página
     * @param sessionStorageData Objeto con todos los datos de sessionStorage
     * @returns Una instancia de Course o null si no se encuentra
     */
    static async fromHrefAndStorage(href: string, sessionStorageData: Record<string, string>): Promise<Course | null> {
        console.log('[Course.fromHrefAndStorage] Analizando URL:', href);
        console.log('[Course.fromHrefAndStorage] Datos de sessionStorage recibidos:', Object.keys(sessionStorageData));

        // Caso 1: Estamos en una vista de curso (course/view.php?id=...)
        if (href.includes('egela.ehu.eus/course/view.php?id=')) {
            const courseId = new URL(href).searchParams.get('id');
            if (!courseId) return null;

            console.log('[Course.fromHrefAndStorage] Detectado courseId:', courseId);

            // Buscar datos del curso en sessionStorage
            const courseKey = `-716233041/course/${courseId}/staticState`;
            const courseDataStr = sessionStorageData[courseKey];

            if (!courseDataStr) {
                console.error('[Course.fromHrefAndStorage] No se encontraron datos del curso en sessionStorage');
                return null;
            }

            try {
                const courseData = JSON.parse(courseDataStr);
                return new Course(courseData);
            } catch (error) {
                console.error('[Course.fromHrefAndStorage] Error al parsear datos del curso:', error);
                return null;
            }
        }

        // Caso 2: Estamos en una página/recurso (mod/page/view.php?id=...)
        if (href.includes('egela.ehu.eus/mod/')) {
            const resourceId = new URL(href).searchParams.get('id');
            if (!resourceId) return null;

            console.log('[Course.fromHrefAndStorage] Detectado resourceId:', resourceId);
            console.log('[Course.fromHrefAndStorage] Buscando curso que contenga este recurso...');

            // Buscar en todos los cursos del sessionStorage
            for (const [key, value] of Object.entries(sessionStorageData)) {
                if (!key.includes('-716233041/course/') || !key.endsWith('/staticState')) continue;

                try {
                    const courseData = JSON.parse(value);

                    // Verificar si este curso contiene el recurso
                    const hasResource = courseData.cm?.some((cm: any) => cm.id === resourceId);

                    if (hasResource) {
                        console.log('[Course.fromHrefAndStorage] Curso encontrado!');
                        return new Course(courseData);
                    }
                } catch (error) {
                    // Ignorar errores de parsing para otros datos
                    continue;
                }
            }

            console.error('[Course.fromHrefAndStorage] No se encontró ningún curso con el recurso:', resourceId);
            return null;
        }

        console.log('[Course.fromHrefAndStorage] URL no reconocida como curso o recurso de Egela');
        return null;
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

    async getSectionContent(sectionId: string): Promise<string> {
        // Verificar que la sección existe en el curso
        const section = this.getSectionById(sectionId);
        if (!section) {
            throw new Error(`La sección con id '${sectionId}' no existe en el curso`);
        }

        console.log("La sección existe, procediendo a obtener su contenido...");

        try {
            // Obtener el HTML de la sección directamente (estamos en background)
            const html = await fetchSectionHtml(this.id, section.section);
            console.log("HTML obtenido, longitud:", html.length);

            // Parsear el HTML recibido usando linkedom (compatible con Service Workers)
            const { document: doc } = parseHTML(html);

            // Buscar el elemento de la sección usando querySelector
            const sectionElementId = `section-${section.section}`;
            const sectionElement = doc.querySelector(`li#${sectionElementId}.section.course-section`);

            if (!sectionElement) {
                throw new Error(`No se encontró el elemento HTML de la sección con id: ${sectionElementId}`);
            }

            // Usar SectionParser para extraer el contenido
            const parser = new SectionParser();
            const result = parser.parseSection(sectionElement, section);

            return result;

        } catch (error) {
            if (error instanceof Error) {
                throw error;
            }
            throw new Error('Error desconocido al obtener el contenido de la sección');
        }
    }

    async getResourceFile(resourceId: string): Promise<{
        blob: Blob;
        filename: string;
        mimeType: string;
        size: number;
        resourceName: string;
    }> {
        console.log(`[Course.getResourceFile] Obteniendo recurso: ${resourceId}`);

        // Verificar que el recurso existe en alguna sección
        let foundResource = null;
        for (const section of this.sections) {
            const resource = section.resources.find(r => r.id === resourceId);
            if (resource) {
                foundResource = resource;
                break;
            }
        }

        if (!foundResource) {
            console.error(`[Course.getResourceFile] Recurso no encontrado: ${resourceId}`);
            throw new Error(`El recurso con id '${resourceId}' no existe en el curso`);
        }

        console.log(`[Course.getResourceFile] Recurso encontrado: ${foundResource.name}`);

        if (!foundResource.isDownloadable()) {
            console.error(`[Course.getResourceFile] Recurso no descargable: ${foundResource.name}`);
            throw new Error(`El recurso '${foundResource.name}' no es descargable`);
        }

        // Delegar la descarga a FileManager
        const fileData = await FileManager.downloadResourceFile(resourceId);

        return {
            ...fileData,
            resourceName: foundResource.name
        };
    }

    /**
     * Obtiene el contenido de una página de ejercicios parseado en formato Markdown
     * @param pageId ID de la página (por ejemplo: "9210914")
     * @returns El contenido de la página en formato Markdown junto con los archivos detectados
     */
    async getPageContent(pageId: string): Promise<{ markdown: string; files: FileData[] }> {
        console.log(`[getPageContent] Obteniendo contenido de la página: ${pageId}`);

        try {
            // 1. Obtener el HTML de la página
            const html = await fetchPageHtml(pageId);
            console.log(`[getPageContent] HTML obtenido, longitud: ${html.length}`);

            // 2. Parsear el HTML usando linkedom
            const { document: doc } = parseHTML(html);

            // 3. Buscar el contenedor principal de contenido
            const mainContent = doc.querySelector('div[role="main"]');

            if (!mainContent) {
                throw new Error('No se encontró el contenido principal de la página');
            }

            // 4. Usar PageParser para parsear el contenido a Markdown y detectar archivos
            const parser = new PageParser(pageId);
            const result = await parser.parseToMarkdown(mainContent);

            console.log(`[getPageContent] Contenido parseado exitosamente, longitud: ${result.markdown.length}, archivos: ${result.files.length}`);
            return result;

        } catch (error) {
            console.error(`[getPageContent] Error al obtener el contenido de la página:`, error);
            if (error instanceof Error) {
                throw error;
            }
            throw new Error('Error desconocido al obtener el contenido de la página');
        }
    }

    /**
     * Verifica si el usuario actual es profesor en este curso
     * @returns true si el usuario actual tiene rol de profesor, false en caso contrario
     */
    async isCurrentUserTeacher(): Promise<boolean> {
        console.log(`[isCurrentUserTeacher] Verificando rol del usuario en curso ${this.id}`);

        try {
            // 1. Obtener el correo electrónico del usuario actual desde su perfil
            const profileUrl = 'https://egela.ehu.eus/user/profile.php';
            const profileResponse = await fetch(profileUrl);
            if (!profileResponse.ok) {
                throw new Error(`Error al obtener perfil: ${profileResponse.status}`);
            }

            const profileHtml = await profileResponse.text();
            const { document: profileDoc } = parseHTML(profileHtml);

            // Selector para obtener el correo del usuario actual
            const emailElement = profileDoc.querySelector('#region-main-box > div > div.col-md-4 > div > div.userinfo.my-2 > ul > li > dl > dd > a');
            if (!emailElement) {
                console.error('[isCurrentUserTeacher] No se pudo obtener el correo del usuario actual');
                return false;
            }

            const currentUserEmail = emailElement.textContent?.trim();
            if (!currentUserEmail) {
                console.error('[isCurrentUserTeacher] El correo del usuario actual está vacío');
                return false;
            }

            console.log(`[isCurrentUserTeacher] Correo del usuario actual: ${currentUserEmail}`);

            // 2. Obtener la lista de participantes del curso
            const participantsUrl = `https://egela.ehu.eus/user/index.php?id=${this.id}`;
            const participantsResponse = await fetch(participantsUrl);
            if (!participantsResponse.ok) {
                throw new Error(`Error al obtener participantes: ${participantsResponse.status}`);
            }

            const participantsHtml = await participantsResponse.text();
            const { document: participantsDoc } = parseHTML(participantsHtml);

            // 3. Buscar el usuario actual en la lista de participantes
            let userIndex = 0;
            while (true) {
                const userNameCellId = `user-index-participants-${this.id}_r${userIndex}_c1`;
                const userNameCell = participantsDoc.querySelector(`#${userNameCellId}`);

                if (!userNameCell) {
                    // No hay más usuarios en la lista
                    console.warn(`[isCurrentUserTeacher] Usuario ${currentUserEmail} no encontrado en la lista de participantes`);
                    return false;
                }

                // Obtener el enlace al perfil del usuario
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

                // Obtener el correo del usuario desde su perfil
                const userProfileResponse = await fetch(userProfileUrl);
                if (!userProfileResponse.ok) {
                    userIndex++;
                    continue;
                }

                const userProfileHtml = await userProfileResponse.text();
                const { document: userProfileDoc } = parseHTML(userProfileHtml);

                const userEmailElement = userProfileDoc.querySelector('#region-main-box > div > div.col-md-4 > div > div.userinfo.my-2 > ul > li > dl > dd > a');
                const userEmail = userEmailElement?.textContent?.trim();

                // Si es el usuario actual, obtener su rol
                if (userEmail === currentUserEmail) {
                    const userRoleCellId = `user-index-participants-${this.id}_r${userIndex}_c2`;
                    const userRoleCell = participantsDoc.querySelector(`#${userRoleCellId}`);

                    if (!userRoleCell) {
                        console.error(`[isCurrentUserTeacher] No se pudo obtener el rol para el usuario ${currentUserEmail}`);
                        return false;
                    }

                    const role = userRoleCell.textContent?.trim();
                    console.log(`[isCurrentUserTeacher] Rol encontrado: ${role}`);

                    // Verificar si el rol es "Profesor" (o variaciones)
                    const isTeacher =
                        [
                            'Teacher', 'Profesor', 'Irakaslea',
                            'Eskuz matrikulatutako ikaslea', 'Estudiante manual', 'Manual enrollment student' // TODO: Eliminar esto. Solo para que yo pueda probar sin ser profesor
                        ].includes(role);
                    return isTeacher;
                }

                userIndex++;
            }

        } catch (error) {
            console.error('[isCurrentUserTeacher] Error al verificar el rol del usuario:', error);
            return false;
        }
    }
}