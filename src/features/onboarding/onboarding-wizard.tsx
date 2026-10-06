'use client';

import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  Switch,
} from '@/components/ui';
import {
  onboardingCompanySchema,
  onboardingInvoiceSchema,
  onboardingPlanSchema,
  onboardingSchema,
} from '@/lib/validators';
import type { AuthFeedback } from '@/features/auth';
import { AuthFeedbackMessage } from '@/features/auth';
import type { OnboardingAction, OnboardingInput, OnboardingPlanOption } from './onboarding-types';
import { DEFAULT_ONBOARDING_PLANS } from './onboarding-types';

const STEP_LABELS = ['Plan', 'Company', 'Invoice setup'];

type WizardStep = 0 | 1 | 2;

export function OnboardingWizard({
  onComplete,
  plans = DEFAULT_ONBOARDING_PLANS,
}: {
  readonly onComplete?: OnboardingAction;
  readonly plans?: readonly OnboardingPlanOption[];
}): ReactNode {
  const [step, setStep] = useState<WizardStep>(0);
  const [values, setValues] = useState<OnboardingInput>({
    planTierId: 'free',
    companyName: '',
    industry: 'service',
    defaultCountry: 'US',
    defaultCurrency: 'USD',
    invoicePrefix: 'INV',
    paymentTermsDays: 30,
    requireEmailOtpForClientLinks: false,
  });
  const [feedback, setFeedback] = useState<AuthFeedback | null>(null);
  const [isPending, setIsPending] = useState(false);
  const update = <TKey extends keyof OnboardingInput>(key: TKey, value: OnboardingInput[TKey]) =>
    setValues((current) => ({ ...current, [key]: value }));
  const validateStep = (): boolean => {
    const schema =
      step === 0
        ? onboardingPlanSchema
        : step === 1
          ? onboardingCompanySchema
          : onboardingInvoiceSchema;
    const parsed = schema.safeParse(
      step === 0
        ? { planTierId: values.planTierId }
        : step === 1
          ? {
              companyName: values.companyName,
              industry: values.industry,
              defaultCountry: values.defaultCountry,
              defaultCurrency: values.defaultCurrency,
            }
          : {
              invoicePrefix: values.invoicePrefix,
              paymentTermsDays: values.paymentTermsDays,
              requireEmailOtpForClientLinks: values.requireEmailOtpForClientLinks,
            }
    );
    if (!parsed.success) {
      setFeedback({
        type: 'error',
        message: parsed.error.issues[0]?.message ?? 'Check the highlighted fields.',
      });
      return false;
    }
    setFeedback(null);
    return true;
  };
  const next = () => {
    if (!validateStep()) return;
    setStep((current) => Math.min(2, current + 1) as WizardStep);
  };
  const back = () => {
    setFeedback(null);
    setStep((current) => Math.max(0, current - 1) as WizardStep);
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validateStep()) return;
    const parsed = onboardingSchema.safeParse(values);
    if (!parsed.success) {
      setFeedback({
        type: 'error',
        message: parsed.error.issues[0]?.message ?? 'Check the highlighted fields.',
      });
      return;
    }
    setIsPending(true);
    if (!onComplete) {
      setFeedback({ type: 'error', message: 'Onboarding service is not available for this page.' });
      setIsPending(false);
      return;
    }
    try {
      const result = await onComplete(parsed.data);
      setFeedback(
        result.success
          ? { type: 'success', message: 'Your company workspace is ready.' }
          : { type: 'error', message: result.error }
      );
    } catch {
      setFeedback({ type: 'error', message: 'We could not complete onboarding.' });
    } finally {
      setIsPending(false);
    }
  };
  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="flex items-center gap-2" aria-label="Onboarding progress">
        {STEP_LABELS.map((label, index) => (
          <div key={label} className="flex min-w-0 flex-1 items-center gap-2">
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${index < step ? 'bg-success text-success-foreground' : index === step ? 'bg-primary text-primary-foreground' : 'bg-surface-muted text-muted-foreground'}`}
            >
              {index < step ? <Check className="h-4 w-4" aria-hidden="true" /> : index + 1}
            </span>
            <span className="hidden truncate text-xs font-semibold text-muted-foreground sm:block">
              {label}
            </span>
            {index < STEP_LABELS.length - 1 ? <span className="h-px flex-1 bg-border" /> : null}
          </div>
        ))}
      </div>
      {step === 0 ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Choose a starting plan</CardTitle>
                <CardDescription>
                  Free is selected by default. You can change plans later.
                </CardDescription>
              </div>
              <Badge variant="brand">No lock-in</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {plans.map((plan) => (
                <button
                  key={plan.tierId}
                  type="button"
                  aria-pressed={values.planTierId === plan.tierId}
                  className={`rounded-xl border p-4 text-left transition-colors ${values.planTierId === plan.tierId ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-500/20 dark:bg-brand-950' : 'border-border hover:border-brand-300'}`}
                  onClick={() => update('planTierId', plan.tierId)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-foreground">{plan.name}</span>
                    {plan.isRecommended ? <Badge variant="success">Recommended</Badge> : null}
                  </div>
                  <p className="mt-2 text-sm leading-5 text-muted-foreground">{plan.summary}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
      {step === 1 ? (
        <Card>
          <CardHeader>
            <CardTitle>Tell us about your company</CardTitle>
            <CardDescription>
              This information sets your initial tenant context and defaults.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <Label htmlFor="onboarding-company" required>
                Company name
              </Label>
              <Input
                id="onboarding-company"
                value={values.companyName}
                onChange={(event) => update('companyName', event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="onboarding-industry" required>
                Industry
              </Label>
              <Select
                id="onboarding-industry"
                value={values.industry}
                onChange={(event) =>
                  update('industry', event.target.value as OnboardingInput['industry'])
                }
              >
                <option value="service">Service business</option>
                <option value="retail">Retail</option>
                <option value="medical">Medical</option>
                <option value="professional_services">Professional services</option>
                <option value="ecommerce">E-commerce</option>
                <option value="other">Other</option>
              </Select>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <Label htmlFor="onboarding-country" required>
                  Default country
                </Label>
                <Input
                  id="onboarding-country"
                  maxLength={2}
                  value={values.defaultCountry}
                  onChange={(event) => update('defaultCountry', event.target.value.toUpperCase())}
                />
              </div>
              <div>
                <Label htmlFor="onboarding-currency" required>
                  Default currency
                </Label>
                <Input
                  id="onboarding-currency"
                  maxLength={3}
                  value={values.defaultCurrency}
                  onChange={(event) => update('defaultCurrency', event.target.value.toUpperCase())}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}
      {step === 2 ? (
        <Card>
          <CardHeader>
            <CardTitle>Set your invoice defaults</CardTitle>
            <CardDescription>
              These defaults can be changed from company settings later.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <Label htmlFor="onboarding-prefix" required>
                Invoice prefix
              </Label>
              <Input
                id="onboarding-prefix"
                maxLength={16}
                value={values.invoicePrefix}
                onChange={(event) => update('invoicePrefix', event.target.value.toUpperCase())}
              />
              <p className="mt-1.5 text-xs text-muted-foreground">Example: INV-1001</p>
            </div>
            <div>
              <Label htmlFor="onboarding-terms">Payment terms in days</Label>
              <Input
                id="onboarding-terms"
                type="number"
                min={0}
                max={3650}
                value={values.paymentTermsDays}
                onChange={(event) => update('paymentTermsDays', Number(event.target.value))}
              />
            </div>
            <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface-muted p-4">
              <div>
                <Label htmlFor="onboarding-otp" className="mb-0">
                  Require email OTP for client links
                </Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Adds an email check before a client opens an invoice link.
                </p>
              </div>
              <Switch
                id="onboarding-otp"
                checked={values.requireEmailOtpForClientLinks}
                onCheckedChange={(checked) => update('requireEmailOtpForClientLinks', checked)}
              />
            </div>
          </CardContent>
        </Card>
      ) : null}
      {feedback ? <AuthFeedbackMessage feedback={feedback} /> : null}
      <div className="flex items-center justify-between gap-3">
        {step > 0 ? (
          <Button
            type="button"
            variant="quiet"
            onClick={back}
            leftIcon={<ChevronLeft className="h-4 w-4" aria-hidden="true" />}
          >
            Back
          </Button>
        ) : (
          <span />
        )}
        {step < 2 ? (
          <Button
            type="button"
            onClick={next}
            rightIcon={<ChevronRight className="h-4 w-4" aria-hidden="true" />}
          >
            Continue
          </Button>
        ) : (
          <Button type="submit" loading={isPending} loadingLabel="Creating workspace">
            Create workspace
          </Button>
        )}
      </div>
      {step === 2 && !onComplete ? (
        <Alert variant="info">
          Connect the server onboarding action before creating a live workspace.
        </Alert>
      ) : null}
    </form>
  );
}
