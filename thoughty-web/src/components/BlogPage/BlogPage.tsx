import { useMemo, useState } from 'react';

import Footer from '../Footer/Footer';
import '../IntroPage/IntroPage.css';
import './BlogPage.css';

interface BlogPageProps {
  readonly theme?: 'light' | 'dark';
  readonly t: (key: string, params?: Record<string, string | number>) => string;
  readonly onBackHome: () => void;
}

const BLOG_POSTS = [
  {
    id: 'updates',
    categoryKey: 'blogCategoryUpdate',
    titleKey: 'blogUpdateTitle',
    excerptKey: 'blogUpdateExcerpt',
    bodyKey: 'blogUpdateBody',
    dateKey: 'blogUpdateDate',
  },
  {
    id: 'tips',
    categoryKey: 'blogCategoryTips',
    titleKey: 'blogTipsTitle',
    excerptKey: 'blogTipsExcerpt',
    bodyKey: 'blogTipsBody',
    dateKey: 'blogTipsDate',
  },
  {
    id: 'inspiration',
    categoryKey: 'blogCategoryInspiration',
    titleKey: 'blogInspirationTitle',
    excerptKey: 'blogInspirationExcerpt',
    bodyKey: 'blogInspirationBody',
    dateKey: 'blogInspirationDate',
  },
] as const;

type BlogPostId = typeof BLOG_POSTS[number]['id'];

function BlogPage({ theme, t, onBackHome }: Readonly<BlogPageProps>) {
  const [selectedPostId, setSelectedPostId] = useState<BlogPostId>(BLOG_POSTS[0].id);
  const isLight = theme === 'light';
  const selectedPost = useMemo(
    () => BLOG_POSTS.find((post) => post.id === selectedPostId) ?? BLOG_POSTS[0],
    [selectedPostId],
  );

  return (
    <div className={`intro-page ${isLight ? 'light' : 'dark'}`}>
      <main className="blog-page">
        <section className="blog-hero">
          <div className="blog-copy">
            <p className="intro-eyebrow">{t('blogEyebrow')}</p>
            <h1>{t('blogTitle')}</h1>
            <p>{t('blogSubtitle')}</p>
            <button type="button" className="intro-btn secondary" onClick={onBackHome}>
              {t('back')}
            </button>
          </div>
          <article className="blog-featured">
            <span>{t(selectedPost.categoryKey)}</span>
            <h2>{t(selectedPost.titleKey)}</h2>
            <p>{t(selectedPost.bodyKey)}</p>
            <time>{t(selectedPost.dateKey)}</time>
          </article>
        </section>

        <section className="landing-section blog-index">
          <div className="section-heading">
            <p className="section-kicker">{t('blogIndexKicker')}</p>
            <h2>{t('blogIndexTitle')}</h2>
          </div>
          <div className="blog-posts" aria-label={t('blogIndexTitle')}>
            {BLOG_POSTS.map((post) => (
              <article className="blog-post" key={post.id}>
                <span>{t(post.categoryKey)}</span>
                <h3>{t(post.titleKey)}</h3>
                <p>{t(post.excerptKey)}</p>
                <button
                  type="button"
                  className="intro-btn secondary"
                  onClick={() => setSelectedPostId(post.id)}
                >
                  {selectedPostId === post.id ? t('blogReading') : t('blogRead')}
                </button>
              </article>
            ))}
          </div>
        </section>
      </main>
      <Footer t={t} theme={theme ?? 'dark'} />
    </div>
  );
}

export default BlogPage;
