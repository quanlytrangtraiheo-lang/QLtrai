/**
 * Firestore Security Rules Verification Specification (Dirty Dozen Adversarial Suite)
 * Run with Firebase Emulator Suite (@firebase/rules-unit-testing) when testing locally.
 */
export interface AdversarialTestCase {
  id: number;
  name: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  expected: 'PERMISSION_DENIED';
  description: string;
}

export const DIRTY_DOZEN_TESTS: AdversarialTestCase[] = [
  {
    id: 1,
    name: 'Unauthenticated Read',
    operation: 'get',
    path: '/farms/farm1/sows/sow1',
    expected: 'PERMISSION_DENIED',
    description: 'Requests with auth == null must be denied by default catch-all and isVerified().',
  },
  {
    id: 2,
    name: 'Unverified Admin Email Spoof',
    operation: 'create',
    path: '/farms/farm1',
    expected: 'PERMISSION_DENIED',
    description: 'Email matching admin with email_verified == false must fail isVerified().',
  },
  {
    id: 3,
    name: 'PII Cross-User Get',
    operation: 'get',
    path: '/users/userA',
    expected: 'PERMISSION_DENIED',
    description: 'Authenticated User B reading User A profile with email must be denied.',
  },
  {
    id: 4,
    name: 'Shadow Field Injection on Create',
    operation: 'create',
    path: '/farms/farm1/sows/sow1',
    expected: 'PERMISSION_DENIED',
    description: 'Payload containing ghost field isVerified: true must fail keys().hasOnly().',
  },
  {
    id: 5,
    name: 'Shadow Field Injection on Update',
    operation: 'update',
    path: '/farms/farm1/pigGroups/grp1',
    expected: 'PERMISSION_DENIED',
    description: 'Update containing ghost field bypassAudit: true must fail affectedKeys().hasOnly().',
  },
  {
    id: 6,
    name: 'ID Poisoning Guard',
    operation: 'create',
    path: '/farms/farm1/sows/invalid$id space',
    expected: 'PERMISSION_DENIED',
    description: 'Document ID not matching ^[a-zA-Z0-9_-]+$ must fail isValidId().',
  },
  {
    id: 7,
    name: 'Identity Spoofing on Create',
    operation: 'create',
    path: '/farms/farm1/sows/sow2',
    expected: 'PERMISSION_DENIED',
    description: 'Setting createdBy to another UID must fail incoming().createdBy == request.auth.uid.',
  },
  {
    id: 8,
    name: 'Client Timestamp Forgery',
    operation: 'create',
    path: '/farms/farm1/transactions/tx1',
    expected: 'PERMISSION_DENIED',
    description: 'Setting createdAt to arbitrary past date must fail incoming().createdAt == request.time.',
  },
  {
    id: 9,
    name: 'Immutable Field Mutation',
    operation: 'update',
    path: '/farms/farm1/transactions/tx1',
    expected: 'PERMISSION_DENIED',
    description: 'Attempting to change farmId or createdBy must fail hasImmutableBaseFields().',
  },
  {
    id: 10,
    name: 'Non-Member List Query Scraping',
    operation: 'list',
    path: '/farms/farm1/transactions',
    expected: 'PERMISSION_DENIED',
    description: 'User B listing farm1 transactions fails isListAuthorized(resource.data).',
  },
  {
    id: 11,
    name: 'Staff Privilege Escalation',
    operation: 'update',
    path: '/farms/farm1/staff/workerUid',
    expected: 'PERMISSION_DENIED',
    description: 'Worker role cannot escalate their own role to admin due to isFarmManagerOrOwner().',
  },
  {
    id: 12,
    name: 'Resource Exhaustion String Size',
    operation: 'create',
    path: '/farms/farm1/healthLogs/log1',
    expected: 'PERMISSION_DENIED',
    description: 'Symptoms exceeding 800 characters must fail isValidOptStr(data, symptoms, 800).',
  },
];
