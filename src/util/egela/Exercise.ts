export { Exercise };

/**
 * Representa un ejercicio encontrado en una página de Egela
 */
class Exercise {
    name: string;
    statement: string;
    allowed?: boolean;
    isTiquismiqui?: boolean;

    constructor(name: string, statement: string, allowed: boolean = true, isTiquismiqui: boolean = false) {
        this.name = name;
        this.statement = statement;
        this.allowed = allowed;
        this.isTiquismiqui = isTiquismiqui;
    }

    toJSON() {
        return {
            name: this.name,
            statement: this.statement,
            allowed: this.allowed,
            isTiquismiqui: this.isTiquismiqui
        };
    }
}
