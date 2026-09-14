-- Push notifications for new messages and friend requests.
--
-- The expo-notifications edge function already knew how to build and send
-- these, but nothing ever called it: this project has no database webhooks,
-- so the function sat idle and no notification was ever delivered.
--
-- These triggers are what Supabase's "Database Webhooks" UI creates under the
-- hood — pg_net plus a trigger that posts the changed row to the function.
--
-- The function runs with verify_jwt off so the database can reach it without a
-- user session, and authenticates the call with a shared secret instead. The
-- secret lives in Vault rather than in this file, so it is not committed. See
-- the companion note in the pull request for the two values to set.

create extension if not exists pg_net with schema extensions;

-- Reads the shared secret and the project URL out of Vault. Returns null when
-- either is missing, which makes notify_push_event a no-op rather than an
-- error that would roll back the message being sent.
create or replace function public.push_hook_setting(setting_name text)
returns text
language sql
security definer
set search_path = ''
as $$
    select decrypted_secret
    from vault.decrypted_secrets
    where name = setting_name
    limit 1;
$$;

revoke all on function public.push_hook_setting(text) from public, anon, authenticated;

/**
 * Post the changed row to the edge function.
 *
 * Deliberately forgiving: a notification is a nice-to-have, and a failure to
 * send one must never stop the message or friend request itself from being
 * written. net.http_post queues the request and returns immediately, so this
 * does not slow the write down either.
 */
create or replace function public.notify_push_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    fn_url text;
    hook_secret text;
begin
    fn_url := public.push_hook_setting('push_hook_url');
    hook_secret := public.push_hook_setting('push_hook_secret');

    if fn_url is null or hook_secret is null then
        return null;
    end if;

    perform extensions.net.http_post(
        url := fn_url,
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-notify-secret', hook_secret
        ),
        body := jsonb_build_object(
            'type', tg_op,
            'table', tg_table_name,
            'record', to_jsonb(new),
            'old_record', case when tg_op = 'UPDATE' then to_jsonb(old) else null end
        ),
        timeout_milliseconds := 5000
    );

    return null;
exception
    when others then
        raise warning 'notify_push_event failed: %', sqlerrm;
        return null;
end;
$$;

-- AFTER ... FOR EACH ROW: the row is already committed-bound by the time the
-- notification goes out, so a recipient can never be told about a message that
-- then fails to save.
drop trigger if exists on_message_created_notify on public.messages;
create trigger on_message_created_notify
    after insert on public.messages
    for each row
    execute function public.notify_push_event();

drop trigger if exists on_friendship_created_notify on public.friendships;
create trigger on_friendship_created_notify
    after insert on public.friendships
    for each row
    execute function public.notify_push_event();

-- Only when the status actually moves, so unrelated edits stay quiet.
drop trigger if exists on_friendship_accepted_notify on public.friendships;
create trigger on_friendship_accepted_notify
    after update of status on public.friendships
    for each row
    when (old.status is distinct from new.status)
    execute function public.notify_push_event();
