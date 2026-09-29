// NexCargo MOD-016 — Template Rendering Engine Tests (C5-I)
// C5 Increment 1 — Authorized per HAO-C5-001 (2026-09-09)
// Tests: renderTemplate, selectLocalizedContent, injectVariables, buildLocalizedContent, isTemplateReadable

import { describe, it, expect } from 'vitest';
import { PriorityLevel, TemplateStatus, DeliveryStatus, NotificationChannel } from '../domain/enums';
import type { TemplateObject, TemplateVariable } from '../domain/types/entities';
import {
  renderTemplate,
  selectLocalizedContent,
  injectVariables,
  buildLocalizedContent,
  isTemplateReadable,
} from '../application/template-rendering-engine';

describe('MOD-016 Template Rendering Engine', () => {
  const makeBaseTemplate = (overrides?: Partial<TemplateObject>): TemplateObject => ({
    id: 'tmpl-base-id',
    templateId: 'welcome_email',
    templateKey: 'welcome_email',
    channelType: NotificationChannel.IN_APP,
    status: 'ACTIVE' as TemplateStatus,
    variables: [{ name: 'userName' }, { name: 'accountCreationDate' }],
    defaultContent: 'Hello {userName}, welcome to NexCargo!',
    localizedContent: { pt: 'Olá {userName}, bem-vindo à NexCargo!' },
    version: 1,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  });

  describe('selectLocalizedContent', () => {
    it('should use requested locale when available', () => {
      const template = makeBaseTemplate({
        localizedContent: { pt: 'Portuguese content', en: 'English content' },
      });

      expect(selectLocalizedContent(template, 'en')).toBe('English content');
      expect(selectLocalizedContent(template, 'pt')).toBe('Portuguese content');
    });

    it('should fall back to primary locale (pt) when requested not available', () => {
      const template = makeBaseTemplate({
        localizedContent: { pt: 'Portuguese only content' },
      });

      expect(selectLocalizedContent(template, 'fr')).toBe('Portuguese only content');
      expect(selectLocalizedContent(template, 'de')).toBe('Portuguese only content');
    });

    it('should use fallback locale (en) when neither requested nor pt available', () => {
      const template = makeBaseTemplate({
        localizedContent: { en: 'Fallback English content' },
      });

      expect(selectLocalizedContent(template, 'zh')).toBe('Fallback English content');
    });

    it('should use defaultContent when no localized versions available', () => {
      const template = makeBaseTemplate({
        localizedContent: {},
      });

      expect(selectLocalizedContent(template, 'pt')).toBe(makeBaseTemplate().defaultContent);
      expect(selectLocalizedContent(template, 'en')).toBe(makeBaseTemplate().defaultContent);
    });
  });

  describe('injectVariables', () => {
    it('should replace {variableName} with provided values', () => {
      const template = 'Hello {name}, your order {orderId} is confirmed.';
      const variables = { name: 'Maria', orderId: 'ORD-12345' };

      const result = injectVariables(template, variables);

      expect(result).toBe('Hello Maria, your order ORD-12345 is confirmed.');
    });

    it('should format dates in ISO format', () => {
      const template = 'Your appointment is on {date}.';
      const date = new Date('2026-09-15T10:00:00Z');
      const variables = { date };

      const result = injectVariables(template, variables);

      expect(result).toBe('Your appointment is on 2026-09-15.');
    });

    it('should format numbers with decimal places', () => {
      const template = 'Total: R{amount}';
      const variables = { amount: 1250.5 };

      const result = injectVariables(template, variables);

      expect(result).toBe('Total: R1250.50');
    });

    it('should handle integer formatting without decimals', () => {
      const template = 'Quantity: {count}';
      const variables = { count: 42 };

      const result = injectVariables(template, variables);

      expect(result).toBe('Quantity: 42');
    });

    it('should handle multiple occurrences of same variable', () => {
      const template = 'Dear {customer}, reminder about {customer} pending delivery.';
      const variables = { customer: 'Joao' };

      const result = injectVariables(template, variables);

      expect(result).toBe('Dear Joao, reminder about Joao pending delivery.');
    });

    it('should leave unprovided placeholders untouched', () => {
      const template = 'Hello {name}, your balance is {balance}.';
      const variables = { name: 'Ana' };

      const result = injectVariables(template, variables);

      expect(result).toBe('Hello Ana, your balance is {balance}.');
    });
  });

  describe('renderTemplate', () => {
    it('should combine localization selection and variable injection', () => {
      const template = makeBaseTemplate({
        localizedContent: {
          pt: 'Olá {userName}, sua conta foi criada em {accountCreationDate}.',
          en: 'Hello {userName}, your account was created on {accountCreationDate}.',
        },
        variables: [
          { name: 'userName' },
          { name: 'accountCreationDate' },
        ],
      });

      const variables = {
        userName: 'Carlos',
        accountCreationDate: new Date('2026-09-01'),
      };

      // Request English
      const enResult = renderTemplate(template, variables, 'en');
      expect(enResult).toContain('Hello Carlos');
      expect(enResult).toContain('your account was created on');

      // Request Portuguese
      const ptResult = renderTemplate(template, variables, 'pt');
      expect(ptResult).toContain('Olá Carlos');
      expect(ptResult).toContain('sua conta foi criada em');
    });

    it('should fall back to default when requested locale missing', () => {
      const template = makeBaseTemplate({
        localizedContent: { pt: 'Bem-vindo {user}!' },
      });

      const result = renderTemplate(template, { user: 'Test' }, 'es');
      expect(result).toBe('Bem-vindo Test!');
    });
  });

  describe('buildLocalizedContent', () => {
    it('should create a structured object with both pt and en', () => {
      const content = buildLocalizedContent('Conteúdo português', 'English content');

      expect(content.pt).toBe('Conteúdo português');
      expect(content.en).toBe('English content');
    });

    it('should only include provided locales', () => {
      const content = buildLocalizedContent('PT content', 'EN content');

      expect(Object.keys(content)).toHaveLength(2);
      expect(content.pt).toBeDefined();
      expect(content.en).toBeDefined();
    });
  });

  describe('isTemplateReadable', () => {
    it('should return true when defaultContent exists', () => {
      const template = makeBaseTemplate({ defaultContent: 'Some content' });
      expect(isTemplateReadable(template)).toBe(true);
    });

    it('should return true when localizedContent has at least one value', () => {
      const template = makeBaseTemplate({
        localizedContent: { pt: 'Conteúdo aqui' },
      });
      expect(isTemplateReadable(template)).toBe(true);
    });

    it('should return false when both are empty/missing', () => {
      const template = makeBaseTemplate({ 
        defaultContent: '',
        localizedContent: {},
      });
      expect(isTemplateReadable(template)).toBe(false);
    });

    it('should return false when localizedContent has no truthy values', () => {
      const template: Partial<TemplateObject> = {
        defaultContent: '',
        localizedContent: { pt: '', en: '' },
      };
      expect(isTemplateReadable(template)).toBe(false);
    });
  });
});
