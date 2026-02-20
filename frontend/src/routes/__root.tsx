import { createRootRouteWithContext, HeadContent, Scripts } from '@tanstack/react-router';
import { Toaster } from '@/components/ui/sonner';
import type { RouteContext } from '@/hooks/use-route-context';
import appCssInline from '@/styles.css?inline';

export const Route = createRootRouteWithContext<RouteContext>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Bordly' },
    ],
    links: [
      { rel: 'apple-touch-icon', sizes: '180x180', href: '/images/apple-touch-icon.png' },
      { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/images/favicon-32x32.png' },
      { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/images/favicon-16x16.png' },
      { rel: 'manifest', href: '/site.webmanifest' },
    ],
  }),

  notFoundComponent: () => <div>404 - Not Found</div>,

  shellComponent: ({ children }: { children: React.ReactNode }) => (
    <html lang="en">
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: it's safe */}
        <style dangerouslySetInnerHTML={{ __html: appCssInline }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Toaster />
        <Scripts />
      </body>
    </html>
  ),
});
