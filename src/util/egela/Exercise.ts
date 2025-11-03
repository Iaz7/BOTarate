export { Exercise };

/**
 * Representa un ejercicio encontrado en una página de Egela
 */
class Exercise {
    name: string;
    statement: string;

    constructor(name: string, statement: string) {
        this.name = name;
        this.statement = statement;
    }

    toJSON() {
        return {
            name: this.name,
            statement: this.statement
        };
    }
}
