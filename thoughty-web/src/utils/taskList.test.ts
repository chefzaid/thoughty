import { describe, expect, it } from 'vitest';
import { countLinesBefore, findTaskLines, setTaskLine, untickTasks } from './taskList';

describe('taskList', () => {
    const content = ['# Errands', '- [ ] Call the bank', '- [x] Post the letter', '  * [X] Nested', '> 1. [ ] Quoted', '- [link](https://example.com)', 'Plain'].join('\n');

    it('finds the task lines and whether each is ticked', () => {
        expect([...findTaskLines(content)]).toEqual([[1, false], [2, true], [3, true], [4, false]]);
        expect(findTaskLines('No tasks here').size).toBe(0);
    });

    it('ticks and unticks one line and leaves the others alone', () => {
        expect(setTaskLine(content, 1, true)).toBe(content.replace('- [ ] Call', '- [x] Call'));
        expect(setTaskLine(content, 3, false)).toBe(content.replace('* [X] Nested', '* [ ] Nested'));
        expect(setTaskLine('- [ ] One\r\n- [ ] Two', 1, true)).toBe('- [ ] One\r\n- [x] Two');
    });

    it('refuses lines that are not tasks', () => {
        expect(setTaskLine(content, 0, true)).toBeNull();
        expect(setTaskLine(content, 5, true)).toBeNull();
        expect(setTaskLine(content, 40, true)).toBeNull();
        expect(setTaskLine('- [ ]no space', 0, true)).toBeNull();
    });

    it('counts the lines before a position', () => {
        expect(countLinesBefore('one\ntwo\nthree', 0)).toBe(0);
        expect(countLinesBefore('one\ntwo\nthree', 4)).toBe(1);
        expect(countLinesBefore('one\ntwo\nthree', 9)).toBe(2);
    });

    it('unticks every task and leaves the other lines alone', () => {
        expect(untickTasks('Plan\n- [x] Pack\n> * [X] Quoted\n1. [ ] First\n- [x]no space\nNote [x]'))
            .toBe('Plan\n- [ ] Pack\n> * [ ] Quoted\n1. [ ] First\n- [x]no space\nNote [x]');
    });
});
