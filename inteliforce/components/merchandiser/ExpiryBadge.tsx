// components/merchandiser/ExpiryBadge.tsx
import React from 'react';
import { Badge } from '@/components/ui/Badge';

interface ExpiryBadgeProps {
  daysLeft: number;
}

export function ExpiryBadge({ daysLeft }: ExpiryBadgeProps) {
  if (daysLeft <= 0) {
    return <Badge label="VENCIDO" variant="dark" />;
  }
  if (daysLeft < 30) {
    return <Badge label={`Vence en ${daysLeft}d`} variant="danger" />;
  }
  if (daysLeft <= 60) {
    return <Badge label={`Vence en ${daysLeft}d`} variant="warning" />;
  }
  return <Badge label={`Vence en ${daysLeft}d`} variant="success" />;
}
