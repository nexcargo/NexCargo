import { describe, it, expect } from 'vitest';
import { UserRole, LanguagePreference } from '@/shared/types/enums';

describe('NexCargo Shared Kernel — Infrastructure Bootstrap', () => {
  describe('UserRole enum', () => {
    it('contains SHIPPER role', () => {
      expect(UserRole.SHIPPER).toBe('SHIPPER');
    });

    it('contains TRANSPORTER role', () => {
      expect(UserRole.TRANSPORTER).toBe('TRANSPORTER');
    });

    it('contains DRIVER role', () => {
      expect(UserRole.DRIVER).toBe('DRIVER');
    });

    it('contains DISPATCHER role', () => {
      expect(UserRole.DISPATCHER).toBe('DISPATCHER');
    });

    it('contains MODERATOR role', () => {
      expect(UserRole.MODERATOR).toBe('MODERATOR');
    });

    it('contains ADMIN role', () => {
      expect(UserRole.ADMIN).toBe('ADMIN');
    });

    it('contains SUPER_ADMIN role', () => {
      expect(UserRole.SUPER_ADMIN).toBe('SUPER_ADMIN');
    });

    it('contains AI_SYSTEM_AGENT as internal/system actor (not a human application role)', () => {
      expect(UserRole.AI_SYSTEM_AGENT).toBe('AI_SYSTEM_AGENT');
    });
  });

  describe('LanguagePreference enum', () => {
    it('contains pt (Portuguese) as default', () => {
      expect(LanguagePreference.PT).toBe('pt');
    });

    it('contains en (English)', () => {
      expect(LanguagePreference.EN).toBe('en');
    });
  });
});
