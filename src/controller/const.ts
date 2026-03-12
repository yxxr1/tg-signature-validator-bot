export const DIRECT_CHAT_COMMANDS = {
    SetUserPubkey: 'set_pubkey',
    RevokeUserPubkey: 'revoke_pubkey',
    VerifySignature: 'verify',
    PublishAliases: 'alias',
    CurrentScene: 'scene',
    LeaveCurrentScene: 'leave'
} as const;

export const PUBLIC_CHAT_COMMANDS = {
    SignMessage: 'sign',
    RevokeSignMessage: 'revoke_sign',
    PublishSignedMessage: 'publish',
    StateSignMessage: 'state_sigs',
    GetSignData: 'get_sign_data'
} as const;
