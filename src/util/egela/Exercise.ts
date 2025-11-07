export { Exercise };

/**
 * Representa un ejercicio encontrado en una página de Egela
 */
class Exercise {
    name: string;
    statement: string;
    allowed?: boolean;

    constructor(name: string, statement: string, allowed: boolean = true) {
        this.name = name;
        this.statement = statement;
        this.allowed = allowed;
    }

    toJSON() {
        return {
            name: this.name,
            statement: this.statement,
            allowed: this.allowed
        };
    }
}
