export enum EmailTemplate {
    VERIFY_ACCOUNT = 'verify-account',
    RESET_PASSWORD = 'reset-password',
    TEAM_INVITATION = 'team-invitation'
}

export enum EmailSubject {
    VERIFY_ACCOUNT = 'Verify your email',
    RESET_PASSWORD = 'Reset password',
    TEAM_INVITATION = 'You have been invited to join a team'
}

export interface EmailOptions {
    template: EmailTemplate;
    subject: string;
}
