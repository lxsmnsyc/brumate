// Answers of the HNPWA API for the tests, which run without the network.

const story = (id: number, title: string, extra: Record<string, unknown> = {}) => ({
  id,
  title,
  points: 100 + id,
  user: 'ada',
  time: 1_700_000_000,
  time_ago: '2 hours ago',
  comments_count: 2,
  type: 'link',
  url: `https://example.com/${id}`,
  domain: 'example.com',
  ...extra,
});

export const fixtures: Record<string, unknown> = {
  '/news/1.json': [
    story(1, 'A compiler that ships less code'),
    story(2, 'Ask HN: What do you resume?', {
      type: 'ask',
      url: 'item?id=2',
      domain: undefined,
    }),
  ],
  '/news/2.json': [story(31, 'The second page')],
  '/newest/1.json': [story(3, 'Just posted', { comments_count: 0 })],
  '/item/1.json': {
    ...story(1, 'A compiler that ships less code'),
    content: '',
    comments: [
      {
        id: 10,
        user: 'grace',
        time_ago: '1 hour ago',
        content: '<p>Nice <i>work</i>.<script>alert(1)</script></p>',
        comments: [
          {
            id: 11,
            user: 'linus',
            time_ago: '30 minutes ago',
            content: '<p>Agreed.</p>',
            comments: [],
          },
        ],
      },
    ],
  },
  '/user/ada.json': {
    id: 'ada',
    created: '10 years ago',
    karma: 12345,
    about: '<p>Writes <a href="https://example.com">compilers</a>.</p>',
  },
};
