import crypto from 'crypto';

function hashPassword(password: string): string {
    const salt=crypto.randomBytes(16).toString('hex');
    const hash=crypto.scryptSync(password,salt,64).toString('hex');
    return `${salt}:${hash}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
    const [salt,originalHash]=storedHash.split(':');
    if(!salt||!originalHash)return false;
    const hash=crypto.scryptSync(password,salt,64).toString('hex');
    return hash===originalHash;
}

export { hashPassword, verifyPassword };