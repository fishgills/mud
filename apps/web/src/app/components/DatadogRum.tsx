'use client';

import { datadogRum } from '@datadog/browser-rum';
import { useEffect } from 'react';

function isRumEnabled() {
  return process.env.NEXT_PUBLIC_DD_RUM_ENABLED === 'true';
}

export default function DatadogRum() {
  useEffect(() => {
    if (!isRumEnabled()) return;
    if (datadogRum.getInitConfiguration()) return;

    const applicationId = process.env.NEXT_PUBLIC_DD_APPLICATION_ID;
    const clientToken = process.env.NEXT_PUBLIC_DD_CLIENT_TOKEN;

    if (!applicationId || !clientToken) {
      console.warn(
        '[Datadog RUM] Enabled but missing NEXT_PUBLIC_DD_APPLICATION_ID or NEXT_PUBLIC_DD_CLIENT_TOKEN',
      );
      return;
    }

    datadogRum.init({
      applicationId,
      clientToken,
      site: process.env.NEXT_PUBLIC_DD_SITE ?? 'datadoghq.com',
      service: process.env.NEXT_PUBLIC_DD_SERVICE ?? 'web-site',
      env:
        process.env.NEXT_PUBLIC_DD_ENV ??
        (process.env.NODE_ENV === 'production' ? 'prod' : 'dev'),
      version: process.env.NEXT_PUBLIC_DD_VERSION,
      sessionSampleRate: 100,
      sessionReplaySampleRate: 20,
      trackBfcacheViews: true,
      defaultPrivacyLevel: 'mask-user-input',
    });
  }, []);

  return null;
}
