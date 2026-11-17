export type Semester_Dates = {
    start: string;
    end: string;
}

/**
 * returns start and end dates for current semester
 * - if in "fall semester" (between Sept 1 and dec 22 of current year, submit those dates)
 * - if in "spring semester" (between Jan 1 and May 22) of current year, submit those dates
 * - if outside either date range, submit the date range closest in the future
 */
export function semester_dates(): Semester_Dates {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    const day = today.getDate();

    if (month < 5 || (month === 5 && day <= 22)) {
        return { start: `${year}-01-01`, end: `${year}-05-22` };
    }

    // After May 22, return this year's fall semester through December 22.
    if (month < 12 || day <= 22) {
        return { start: `${year}-09-01`, end: `${year}-12-22` };
    }

    return { start: `${year + 1}-01-01`, end: `${year + 1}-05-22` };
}