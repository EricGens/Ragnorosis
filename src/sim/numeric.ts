/**
 * Tolerance for floating-point dust. Progress, Production and speeds are fractions that get added up
 * tick after tick, so a total that should land exactly on a threshold can come out a hair under
 * (299.99999999999994 of 300 miles). Every "has it reached the threshold?" comparison in the sim allows
 * this much slack, so nothing waits an extra tick — or reads as blockaded, or one unit short — over
 * rounding error. Far smaller than any real quantity in the game.
 */
export const EPSILON = 1e-9
