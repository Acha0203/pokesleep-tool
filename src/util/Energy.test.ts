import Energy from './Energy';
import Nature from './Nature';
import PokemonIv from './PokemonIv';
import SubSkill from './SubSkill';

describe('Energy', () => {
    test('calculate (e4e x 0)', () => {
        const iv = new PokemonIv('Raichu');
        const energy = new Energy(iv);
        const result = energy.calculate(18, 0);

        expect(result.events).toEqual([
            { minutes: 0, type: 'wake', energyBefore: 0, energyAfter: 100, isSnacking: false },
            { minutes: 120, type: 'cook', energyBefore: 88, energyAfter: 89, isSnacking: false },
            { minutes: 360, type: 'cook', energyBefore: 65, energyAfter: 67, isSnacking: false },
            { minutes: 720, type: 'cook', energyBefore: 31, energyAfter: 35, isSnacking: false },
            { minutes: 930, type: 'sleep', energyBefore: 14, energyAfter: 14, isSnacking: false },
            { minutes: 1070, type: 'empty', energyBefore: 0, energyAfter: 0, isSnacking: false },
            { minutes: 1440, type: 'wake', energyBefore: 0, energyAfter: 100, isSnacking: false },
        ]);

        expect(result.efficiencies).toEqual([
            {start: 0, end: 210, efficiency: 2.222, isAwake: true, isSnacking: false},
            {start: 210, end: 430, efficiency: 1.923, isAwake: true, isSnacking: false},
            {start: 430, end: 630, efficiency: 1.613, isAwake: true, isSnacking: false},
            {start: 630, end: 870, efficiency: 1.408, isAwake: true, isSnacking: false},
            {start: 870, end: 930, efficiency: 1, isAwake: true, isSnacking: false},
            {start: 930, end: 1440, efficiency: 1, isAwake: false, isSnacking: false},
        ]);
    });

    test('calculate (e4e x 0, Energy recovery down)', () => {
        const iv = new PokemonIv('Raichu');
        iv.nature = new Nature('Hasty'); // Energy recovery down
        const energy = new Energy(iv);
        const result = energy.calculate(18, 0);

        expect(result.events[0].energyAfter).toBe(88);
        expect(result.efficiencies[0]).toEqual({
            start: 0, end: 80, efficiency: 2.222, isAwake: true, isSnacking: false
        });

        // empty event is added
        const sleepEvent = result.events.find(x => x.type === "sleep");
        const emptyEvent = result.events.find(x => x.type === "empty");
        expect(sleepEvent !== undefined).toBe(true);
        expect(emptyEvent !== undefined).toBe(true);
        if (emptyEvent === undefined || sleepEvent === undefined) { throw new Error(); }
        expect(emptyEvent.minutes === sleepEvent.minutes + sleepEvent.energyAfter * 10);
    });

    test('calculate (e4e x 0, Energy recovery down, Energy Recovery Bonus)', () => {
        const iv = new PokemonIv('Raichu');
        iv.nature = new Nature('Hasty'); // Energy recovery down
        iv.subSkills.lv10 = new SubSkill("Energy Recovery Bonus");
        const energy = new Energy(iv);

        iv.level = 9;
        let result = energy.calculate(18, 0);
        expect(result.events[0].energyAfter).toBe(88);

        iv.level = 10;
        result = energy.calculate(18, 0);
        expect(result.events[0].energyAfter).toBe(100);
    });

    test('calculate (e4e x 2)', () => {
        const iv = new PokemonIv('Pikachu');
        const energy = new Energy(iv);
        const result = energy.calculate(18, 2);

        expect(result.averageEfficiency).toEqual({
            total: 1.713,
            awake: 1.969,
            asleep: 1.244,
        });
    });

    test('calculate (e4e x 7)', () => {
        const iv = new PokemonIv('Pikachu');
        const energy = new Energy(iv);
        const result = energy.calculate(18, 7);

        expect(result.averageEfficiency).toEqual({
            total: 2.222,
            awake: 2.222,
            asleep: 2.222,
        });
    });

    test('calculate (score 0)', () => {
        const iv = new PokemonIv('Pikachu');
        const energy = new Energy(iv);
        const result = energy.calculate(18, 0, 0);

        expect(result.averageEfficiency).toEqual({
            total: 1,
            awake: 1,
            asleep: 1,
        });

        expect(result.events[1].type).toBe('cook');
        expect(result.events[1].energyAfter).toBe(5);
        expect(result.events[1].minutes).toBe(120);
        expect(result.events[2].type).toBe('empty');
        expect(result.events[2].energyBefore).toBe(0);
        expect(result.events[2].minutes).toBe(170);

        expect(result.events[3].type).toBe('cook');
        expect(result.events[3].energyAfter).toBe(5);
        expect(result.events[3].minutes).toBe(360);
        expect(result.events[4].type).toBe('empty');
        expect(result.events[4].energyBefore).toBe(0);
        expect(result.events[4].minutes).toBe(410);
    });

    test('calculate snacking', () => {
        const iv = new PokemonIv('Eevee');
        iv.nature = new Nature('Hasty'); // Energy recovery down
        iv.level = 1;

        // change pokemon parameter
        iv.pokemon = {...iv.pokemon};
        iv.pokemon.carryLimit = 10;
        iv.pokemon.ingRatio = 10;
        iv.pokemon.skillRatio = 10;
        iv.pokemon.frequency = 1800; // 30min

        const energy = new Energy(iv);
        const result = energy.calculate(18, 0, 460);

        // sleep from 980 min
        const sleepEvent = result.events.find(x => x.type === 'sleep');
        expect(sleepEvent).toEqual({
            type: 'sleep', minutes: 980,
            energyBefore: 0, energyAfter: 0, isSnacking: false,
        });

        // snacking from 980 + 300 min (30min x 10)
        const snackEvent = result.events.find(x => x.type === 'snack');
        expect(snackEvent).toEqual({
            type: 'snack', minutes: 1280,
            energyBefore: 0, energyAfter: 0, isSnacking: true,
        });
        expect(result.helpCount.asleepNotFull).toBe(10);
        expect(result.skillProbabilityAfterWakeup).toBe(1 - Math.pow(0.9, 10));

        // efficiency for snacking is added
        const ef = result.efficiencies.find(x => x.isSnacking);
        expect(ef).toEqual({
            start: 1280, end: 1440, efficiency: 1,
            isAwake: false, isSnacking: true,
        });

        // change pokemon's speciality to Berries
        iv.pokemon.speciality = "Berries";
        const energy2 = new Energy(iv);
        const result2 = energy2.calculate(18, 0, 460);

        // snacking earlier
        const snackEvent2 = result2.events.find(x => x.type === 'snack');
        expect(snackEvent2?.minutes).toBeLessThan(1280);
        expect(result2.helpCount.asleepNotFull).toBeCloseTo(10 / 1.9);
    });
});
