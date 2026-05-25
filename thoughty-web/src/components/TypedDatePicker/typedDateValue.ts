const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function formatTypedDateValue(date: Date | null | undefined): string {
    if (!date) {
        return '';
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

export function parseTypedDateValue(value: string): Date | null | undefined {
    const trimmedValue = value.trim();
    if (!trimmedValue) {
        return null;
    }

    const match = ISO_DATE_PATTERN.exec(trimmedValue);
    if (!match) {
        return undefined;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const parsedDate = new Date(year, month - 1, day);
    parsedDate.setHours(0, 0, 0, 0);

    if (
        parsedDate.getFullYear() !== year
        || parsedDate.getMonth() !== month - 1
        || parsedDate.getDate() !== day
    ) {
        return undefined;
    }

    return parsedDate;
}