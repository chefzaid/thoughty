/** Puts a writing prompt in the draft: on its own when the draft is empty, else after a blank line. */
export function appendPrompt(current: string, question: string): string {
    return current.trim() ? `${current}\n\n${question}` : question;
}
