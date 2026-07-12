import React from 'react';

const SEO = ({ title, description, keywords, canonical, ogImage, ogType = 'website' }) => {
  const siteUrl = 'https://strideo.cicdprosystems.com';
  const fullTitle = title ? `${title} | Strideo` : 'Strideo — Enterprise Task Manager & SaaS Board';
  const defaultDesc = 'Strideo is an enterprise-grade multi-tenant task manager with real-time Kanban boards, built-in chat, active timers, advanced analytics, and strict data isolation.';
  const defaultKeywords = 'task manager, enterprise task manager, saas board, kanban board, sprint planning, team chat, time tracking, supabase realtime, project management';

  const canonicalUrl = canonical 
    ? (canonical.startsWith('http') ? canonical : `${siteUrl}${canonical}`)
    : window.location.href;

  const imageUrl = ogImage 
    ? (ogImage.startsWith('http') ? ogImage : `${siteUrl}${ogImage}`)
    : `${siteUrl}/logo-512.png`;

  return (
    <>
      <title>{fullTitle}</title>
      <meta name="description" content={description || defaultDesc} />
      <meta name="keywords" content={keywords || defaultKeywords} />
      <link rel="canonical" href={canonicalUrl} />
      
      {/* Open Graph / Facebook */}
      <meta property="og:type" content={ogType} />
      <meta property="og:title" content={title || 'Strideo — Enterprise Task Manager'} />
      <meta property="og:description" content={description || defaultDesc} />
      <meta property="og:image" content={imageUrl} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:site_name" content="Strideo" />
      
      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title || 'Strideo — Enterprise Task Manager'} />
      <meta name="twitter:description" content={description || defaultDesc} />
      <meta name="twitter:image" content={imageUrl} />
    </>
  );
};

export default SEO;
