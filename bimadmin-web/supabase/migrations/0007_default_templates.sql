-- Adds default communication templates on top of 0001-0006.
--
-- Two things happen here:
--   1. create_organization_for_new_user is redefined to also seed
--      templates for every NEW signup going forward.
--   2. Any organization that already exists with zero templates gets
--      the same starter set backfilled once, so this is safe to run
--      even if you already have test organizations.

create or replace function seed_default_templates(org_id uuid)
returns void
language plpgsql
as $$
begin
  insert into communication_templates (organization_id, channel, name, subject, body) values
    (org_id, 'whatsapp', 'Renewal reminder', null,
      'Hello {{client_name}}, your {{policy_type}} policy is due for renewal on {{expiry_date}}. We would be happy to assist you with your renewal.'),
    (org_id, 'whatsapp', 'Quote follow up', null,
      'Hello {{client_name}}, just following up on the insurance quotation we shared. Please let us know if you have any questions.'),
    (org_id, 'sms', 'Renewal reminder', null,
      'Hi {{client_name}}, your {{policy_type}} policy expires {{expiry_date}}. Contact us to renew. {{intermediary_name}}'),
    (org_id, 'sms', 'Quote follow up', null,
      'Hi {{client_name}}, following up on your insurance quote. Let us know if you have questions. {{intermediary_name}}'),
    (org_id, 'email', 'New quotation', 'Your {{policy_type}} quotation from {{intermediary_name}}',
      'Hi {{client_name}},

Please find your quotation details for {{policy_type}} cover below.

Premium: {{premiumKes}}

Let us know if you would like to proceed.

{{intermediary_name}}'),
    (org_id, 'email', 'Renewal reminder', 'Reminder: your policy {{policy_number}} renews on {{expiry_date}}',
      'Hi {{client_name}},

This is a reminder that your {{policy_type}} policy ({{policy_number}}) is due for renewal on {{expiry_date}}.

We will be in touch shortly to arrange your renewal.

{{intermediary_name}}'),
    (org_id, 'email', 'Renewal confirmation', 'Your policy {{policy_number}} has been renewed',
      'Hi {{client_name}},

Your {{policy_type}} policy has been renewed through {{expiry_date}}.

Thank you for continuing to trust us with your cover.

{{intermediary_name}}'),
    (org_id, 'email', 'Missing documents', 'Documents needed to complete your policy',
      'Hi {{client_name}},

We still need a few documents to finalize your {{policy_type}} policy. Please send these at your earliest convenience.

{{intermediary_name}}'),
    (org_id, 'email', 'Payment reminder', 'Payment reminder: {{policy_number}}',
      'Hi {{client_name}},

This is a friendly reminder that payment for policy {{policy_number}} is outstanding.

{{intermediary_name}}'),
    (org_id, 'email', 'Thank you', 'Thank you, {{client_name}}',
      'Hi {{client_name}},

Thank you for choosing us for your {{policy_type}} cover. We are here whenever you need us.

{{intermediary_name}}');
end;
$$;

create or replace function create_organization_for_new_user(business_name text, owner_full_name text, owner_phone text)
returns uuid
language plpgsql
security definer
as $$
declare
  new_org_id uuid;
  free_plan_id uuid;
begin
  insert into organizations (name) values (business_name) returning id into new_org_id;

  insert into profiles (id, organization_id, full_name, phone, role)
  values (auth.uid(), new_org_id, owner_full_name, owner_phone, 'owner');

  select id into free_plan_id from subscription_plans where key = 'free';
  insert into subscriptions (organization_id, plan_id, status) values (new_org_id, free_plan_id, 'active');

  insert into insurance_types (organization_id, key, label, color, is_custom) values
    (new_org_id, 'medical', 'Medical / Health', 'violet', false),
    (new_org_id, 'motor', 'Motor', 'amber', false),
    (new_org_id, 'life', 'Life', 'emerald', false),
    (new_org_id, 'travel', 'Travel', 'violet', false),
    (new_org_id, 'property', 'Home / Property', 'amber', false),
    (new_org_id, 'personal_accident', 'Personal Accident', 'coral', false),
    (new_org_id, 'business', 'Business', 'emerald', false);

  insert into automation_rules (organization_id, name, trigger_type, trigger_params, action_title, action_task_type, action_offset_days, enabled) values
    (new_org_id, 'Renewal follow-up 30 days before expiry', 'policy_expiring_in_days', '{"days": 30}', 'Contact client regarding renewal', 'renewal', 0, true),
    (new_org_id, 'Follow up 3 days after quotation is sent', 'quotation_sent', '{}', 'Follow up on quotation', 'quote_follow_up', 3, true),
    (new_org_id, 'Call new leads the next day', 'lead_created', '{}', 'Call new lead', 'call', 1, true),
    (new_org_id, 'Remind about missing documents every 3 days', 'policy_pending_documents', '{"everyDays": 3}', 'Chase outstanding documents', 'document_request', 3, false);

  perform seed_default_templates(new_org_id);

  return new_org_id;
end;
$$;

-- Backfill: any organization that somehow has zero templates (every one
-- created before this migration existed) gets the same starter set.
do $$
declare
  org record;
begin
  for org in
    select o.id from organizations o
    where not exists (select 1 from communication_templates where organization_id = o.id)
  loop
    perform seed_default_templates(org.id);
  end loop;
end $$;
