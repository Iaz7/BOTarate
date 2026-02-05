export { Exercise };

/**
 * Represents an exercise found on an Egela page
 */
class Exercise {
    name: string;
    statement: string;
    allowed?: boolean;
    isPicky?: boolean;

    constructor(name: string, statement: string, allowed: boolean = true, isPicky: boolean = false) {
        this.name = name;
        this.statement = statement;
        this.allowed = allowed;
        this.isPicky = isPicky;
    }

    toJSON() {
        return {
            name: this.name,
            statement: this.statement,
            allowed: this.allowed,
            isPicky: this.isPicky
        };
    }
}
