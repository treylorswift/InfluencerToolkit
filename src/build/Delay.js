"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
async function DelaySeconds(secs) {
    return new Promise((resolve, reject) => {
        let oneMinuteMillis = 1000 * secs;
        setTimeout(() => {
            return resolve();
        }, oneMinuteMillis);
    });
}
exports.DelaySeconds = DelaySeconds;
