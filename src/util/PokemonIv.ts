import Nature from './Nature';
import pokemons, { PokemonData } from '../data/pokemons';
import { IngredientType, IngredientTypes } from './PokemonRp';
import { isSkillLevelMax7 } from './MainSkill';
import SubSkill from './SubSkill';
import SubSkillList from './SubSkillList';

/**
 * Represents Indivisual Values (IV) of the Pokemon.
 */
class PokemonIv {
    pokemonName: string;
    pokemon: PokemonData;
    level: number;
    skillLevel: number;
    ingredient: IngredientType;
    subSkills: SubSkillList;
    nature: Nature;

    /** Initialize new instance. */
    constructor(pokemonName: string) {
        this.pokemonName = pokemonName;
        const pokemon = pokemons.find(x => x.name === pokemonName);
        if (pokemon === undefined) {
            throw new Error(`Unknown name: ${pokemonName}`);
        }
        this.pokemon = pokemon;

        // set default value
        this.level = 30;
        this.skillLevel = 3;
        this.ingredient = "ABC";
        this.subSkills = new SubSkillList();
        this.nature = new Nature("Serious");
    }

    /**
     * Creates a deep copy of this instance.
     * @returns A cloned instance.
     */
    clone(): PokemonIv {
        const ret = new PokemonIv(this.pokemonName);
        ret.level = this.level;
        ret.skillLevel = this.skillLevel;
        ret.ingredient = this.ingredient;
        ret.subSkills = this.subSkills.clone();
        ret.nature = this.nature;
        return ret;
    }

    /**
     * Check whether given IV is equal to this IV.
     * @param iv IV to be compared.
     * @returns Whether two IV is equal or not.
     */
    isEqual(iv: PokemonIv): boolean {
        return (this.pokemonName === iv.pokemonName &&
            this.level === iv.level &&
            this.skillLevel === iv.skillLevel &&
            this.ingredient === iv.ingredient &&
            this.subSkills.isEqual(iv.subSkills) &&
            this.nature.name === iv.nature.name);
    }

    /**
     * Check whether the pokemon has an active sub-skill 'Helping Bonus'.
     */
    get hasHelpingBonusInActiveSubSkills(): boolean {
        return this.subSkills
            .getActiveSubSkills(this.level)
            .some(x => x.name === "Helping Bonus");
    }

    /**
     * Serialize IV data to printable string.
     *
     * Format
     * ------
     *
     * First, serialize IV data to following bit array (69bit).
     *
     * * 4bit  : Version (1)
     * * 12bit : Pokedex ID
     *
     * * 6bit  : Form (0: normal, 1: Halloween, 2: Festivo)
     * * 7bit  : level
     * * 3bit  : Ingredient (0: AAA, 1: AAB, 2: ABA, 3: ABB, 4: ABC)
     *
     * * 2bit  : Evoluted count (0: unknown, 1: never, 2: once, 3: twice)
     * * 4bit  : Skill level (0: Lv1, 1: Lv2, ..., 7: Lv8)
     * * 5bit  : Nature index, index of Nature.allNatureNames (0-24)
     * * 5bit  : Sub-skill Lv10 (index of SubSkill.subSkillNames (0-16), unknown: 31)
     *
     * * 5bit  : Sub-skill Lv25
     * * 5bit  : Sub-skill Lv50
     * * 5bit  : Sub-skill Lv75
     * * 1bit  : reserved
     *
     * * 5bit  : Sub-skill Lv100
     *
     * Second, convert bit array using BASE64, and replace '/' to '-',
     * and remove trailing 'AA=='
     */
    serialize(): string {
        const array16 = new Uint16Array(5);
        array16[0] = 1 + (this.pokemon.id << 4);
        const form = (this.pokemon.name === "Pikachu (Halloween)" ? 1 :
            this.pokemon.name === "Pikachu (Festivo)" ? 2 : 0);
        array16[1] = form +
            (this.level << 6) +
            (IngredientTypes.indexOf(this.ingredient) << 13);

        array16[2] = ((this.skillLevel - 1) << 2) +
            (Nature.allNatures.findIndex(x => x.name === this.nature.name) << 6) +
            ((this.subSkills.lv10 === null ? 31 : this.subSkills.lv10.index) << 11);
        array16[3] = (this.subSkills.lv25 === null ? 31 : this.subSkills.lv25.index) +
            ((this.subSkills.lv50 === null ? 31 : this.subSkills.lv50.index) << 5) +
            ((this.subSkills.lv75 === null ? 31 : this.subSkills.lv75.index) << 10);
        array16[4] = (this.subSkills.lv100 === null ? 31 : this.subSkills.lv100.index);

        const array8 = new Uint8Array(array16.buffer);
        let bin = "";
        for (let i = 0; i < array8.length; i++) {
            bin += String.fromCharCode(array8[i]);
        }
        return btoa(bin)
            .replace(/\//g, '-')
            .substring(0, 12); // strip tailing "AA=="
    }

    /**
     * Deserialize serialized string.
     * @param value Serialized string.
     * @returns PokemonIv object.
     */
    static deserialize(value: string): PokemonIv {
        // validate, and convert to BASE64 string
        if (value.length !== 12) {
            throw new Error(`Invalid length ${value.length}`);
        }
        value = value.replace(/-/g, '/') + "AA==";

        // decode BASE64 to Uint16Array
        const bin = atob(value);
        const array8 = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) {
            array8[i] = bin.charCodeAt(i);
        }
        const array16 = new Uint16Array(array8.buffer);

        // validate version
        if ((array16[0] & 0xf) !== 1) {
            throw new Error('Invalid version');
        }

        // get Pokedex ID
        const id = array16[0] >> 4;
        let pokemon = pokemons.find(x => x.id === id);
        if (pokemon === undefined) {
            throw new Error(`Pokemon id ${id} not found`);
        }

        // get form
        const form = array16[1] & 0x3f;
        if (form !== 0) {
            if (pokemon.id !== 25) {
                throw new Error(`Form is not 0 (${form}) for pokemon ${id}`);
            }
            pokemon = undefined;
            if (form === 1) {
                pokemon = pokemons.find(x => x.name === "Pikachu (Halloween)");
            }
            else if (form === 2) {
                pokemon = pokemons.find(x => x.name === "Pikachu (Festivo)");
            }
            if (pokemon === undefined) {
                throw new Error(`Invalid form specified (${form})`);
            }
        }
        const ret = new PokemonIv(pokemon.name);

        // level
        ret.level = (array16[1] >> 6) & 0x7f;
        if (ret.level === 0 || ret.level > 100) {
            throw new Error(`Invalid level (${ret.level})`);
        }

        // ingredient type
        const ing = (array16[1] >> 13) & 0x7;
        if (ing > 5) {
            throw new Error(`Invalid ing value (${ing})`);
        }
        ret.ingredient = IngredientTypes[ing];

        // skill level
        ret.skillLevel = ((array16[2] >> 2) & 0x7) + 1;
        if (ret.skillLevel > (isSkillLevelMax7(pokemon.skill) ? 7 : 6)) {
            throw new Error(`Too large skill level ${ret.skillLevel} for ${pokemon.name}`);
        }

        // nature
        const natureIndex = (array16[2] >> 6) & 31;
        if (natureIndex >= Nature.allNatures.length) {
            throw new Error(`Too large nature ${natureIndex}`);
        }
        ret.nature = Nature.allNatures[natureIndex];

        // sub skill
        const allSubSkills = SubSkill.allSubSkills;
        const getSubSkill = (index: number, lv: number) => {
            if (index === 31) { return null; }
            if (index >= allSubSkills.length) {
                throw new Error(`Too large subskill for level ${lv}: ${index}`);
            }
            return allSubSkills[index];
        };
        ret.subSkills.lv10 = getSubSkill((array16[2] >> 11) & 31, 10);
        ret.subSkills.lv25 = getSubSkill((array16[3] >> 0) & 31, 25);
        ret.subSkills.lv50 = getSubSkill((array16[3] >> 5) & 31, 50);
        ret.subSkills.lv75 = getSubSkill((array16[3] >> 10) & 31, 75);
        ret.subSkills.lv100 = getSubSkill((array16[4] >> 0) & 31, 100);
        return ret;
    }
}

export default PokemonIv;
