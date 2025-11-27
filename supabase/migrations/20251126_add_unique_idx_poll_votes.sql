-- Ensure each user can vote only once per poll
create unique index if not exists idx_poll_votes_poll_user on poll_votes(poll_id, username);
