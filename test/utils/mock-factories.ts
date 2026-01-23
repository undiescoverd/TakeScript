import { Id } from '@/convex/_generated/dataModel';

export function createMockScript(overrides?: Partial<any>) {
  return {
    _id: 'test-script-id' as Id<'scripts'>,
    _creationTime: Date.now(),
    userId: 'test-user-id' as Id<'users'>,
    title: 'Test Script',
    content: JSON.stringify({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Test content' }],
        },
      ],
    }),
    lastEditedAt: Date.now(),
    createdAt: Date.now(),
    ...overrides,
  };
}

export function createMockUser(overrides?: Partial<any>) {
  return {
    _id: 'test-user-id' as Id<'users'>,
    _creationTime: Date.now(),
    tokenIdentifier: 'test-token-identifier',
    email: 'test@example.com',
    name: 'Test User',
    avatar: 'https://example.com/avatar.png',
    ...overrides,
  };
}

export function createMockVersion(overrides?: Partial<any>) {
  return {
    _id: 'test-version-id' as Id<'scriptVersions'>,
    _creationTime: Date.now(),
    scriptId: 'test-script-id' as Id<'scripts'>,
    versionNumber: 1,
    content: JSON.stringify({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Version content' }],
        },
      ],
    }),
    changedBy: 'test-user-id' as Id<'users'>,
    changeNote: 'Test version',
    createdAt: Date.now(),
    ...overrides,
  };
}

export function createMockTiptapContent(paragraphs: number = 1) {
  return {
    type: 'doc',
    content: Array.from({ length: paragraphs }, (_, i) => ({
      type: 'paragraph',
      content: [{ type: 'text', text: `Paragraph ${i + 1}` }],
    })),
  };
}

export function createLargeMockContent(paragraphs: number = 100) {
  return createMockTiptapContent(paragraphs);
}
