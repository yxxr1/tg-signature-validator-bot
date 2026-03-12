export const USER_STATES = {
    NoState: 'NOSTATE',
    WaitPubkey: 'WAIT_PUBKEY',
    WaitVerifyData: 'WAIT_VERIFY_DATA'
} as  const;

export const CALLBACK_QUERY_DATA = {
    VerifySignature: 'verify',
}
