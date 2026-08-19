import crypto from 'crypto';

const BASE32_ALPHABET='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

// encode base32
export function base32Encode(buffer: Buffer): string {
    let bits=0;
    let value=0;
    let output='';
    for(let i=0;i<buffer.length;i++){
        value=(value<<8)|buffer[i];
        bits+=8;
        while(bits>=5){
            output+=BASE32_ALPHABET[(value>>>(bits-5))&31];
            bits-=5;
        }
    }
    if(bits>0){
        output+=BASE32_ALPHABET[(value<<(5-bits))&31];
    }
    return output;
}

// decode base32
export function base32Decode(base32: string): Buffer {
    const cleaned=base32.toUpperCase().replace(/=+$/,'').replace(/[^A-Z2-7]/g,'');
    let bits=0;
    let value=0;
    const bytes: number[]=[];
    for(let i=0;i<cleaned.length;i++){
        const val=BASE32_ALPHABET.indexOf(cleaned[i]);
        if(val===-1) continue;
        value=(value<<5)|val;
        bits+=5;
        if(bits>=8){
            bytes.push((value>>>(bits-8))&255);
            bits-=8;
        }
    }
    return Buffer.from(bytes);
}

// generate totp secret
export function generateTotpSecret(): string {
    const buf=crypto.randomBytes(20);
    return base32Encode(buf);
}

// get otpauth uri
export function getTotpAuthUrl(email: string, secret: string, issuer='SSO Provider'): string {
    return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

// compute totp token
export function computeTotp(secretBase32: string, counter: number): string {
    const key=base32Decode(secretBase32);
    const buf=Buffer.alloc(8);
    let temp=counter;
    for(let i=7;i>=0;i--){
        buf[i]=temp & 0xff;
        temp=Math.floor(temp/256);
    }
    const hmac=crypto.createHmac('sha1',key).update(buf).digest();
    const offset=hmac[hmac.length-1] & 0x0f;
    const binary=((hmac[offset] & 0x7f)<<24)|((hmac[offset+1] & 0xff)<<16)|((hmac[offset+2] & 0xff)<<8)|(hmac[offset+3] & 0xff);
    const otp=binary%1000000;
    return otp.toString().padStart(6,'0');
}

// verify totp token
export function verifyTotp(token: string, secretBase32: string, window=1): boolean {
    if(!token||token.length!==6) return false;
    const nowInSeconds=Math.floor(Date.now()/1000);
    const currentCounter=Math.floor(nowInSeconds/30);

    for(let errorWindow=-window;errorWindow<=window;errorWindow++){
        const expectedOtp=computeTotp(secretBase32,currentCounter+errorWindow);
        if(token===expectedOtp){
            return true;
        }
    }
    return false;
}

// generate recovery codes
export function generateRecoveryCodes(count=8): { plainCodes: string[]; hashedCodes: string[] } {
    const plainCodes: string[]=[];
    const hashedCodes: string[]=[];

    for(let i=0;i<count;i++){
        const code=crypto.randomBytes(5).toString('hex');
        const hash=crypto.createHash('sha256').update(code).digest('hex');
        plainCodes.push(code);
        hashedCodes.push(hash);
    }

    return { plainCodes, hashedCodes };
}

export function hashRecoveryCode(code: string): string {
    return crypto.createHash('sha256').update(code.trim()).digest('hex');
}
