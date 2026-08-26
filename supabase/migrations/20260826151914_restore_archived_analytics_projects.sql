create or replace function analytix_private.sync_projects_from_map(map_nodes jsonb)
returns integer language plpgsql security definer set search_path=public,analytix_private,pg_temp
as $$
declare
  node jsonb;
  node_id text;
  node_url text;
  node_slug text;
  repo text;
  origin text;
  seen text[] := '{}';
  synced integer := 0;
begin
  if jsonb_typeof(map_nodes) <> 'array' then return 0; end if;
  for node in select value from jsonb_array_elements(map_nodes)
  loop
    node_url := nullif(node->>'url','');
    node_id := nullif(node->>'id','');
    if node_url is null or node_id is null or node_url !~ '^https://' then continue; end if;
    node_slug := analytix_private.slugify(coalesce(node->>'title',node_id));
    if node_slug = '' then node_slug := 'project-'||substr(md5(node_id),1,8); end if;
    if node_url ~* '^https://kevinlabens-del\.github\.io/[^/]+/?' then
      repo := 'https://github.com/kevinlabens-del/' || substring(node_url from 'github\.io/([^/]+)');
    else repo := null; end if;
    origin := substring(node_url from '^(https://[^/]+)');
    insert into public.analytics_projects(source_node_id,slug,name,url,repository_url,category,description,version,analytics_enabled,status,allowed_origins,map_metadata)
    values(node_id,node_slug,left(coalesce(node->>'title',node_id),120),node_url,repo,left(coalesce(node->>'type','PROJET'),60),left(coalesce(node->>'desc',''),1000),node->>'version',true,
      case upper(coalesce(node->>'status','PENDING')) when 'ONLINE' then 'ONLINE' when 'DOWN' then 'DOWN' else 'PENDING' end,
      array[origin],node)
    on conflict(source_node_id) do update set
      slug=excluded.slug,
      name=excluded.name,
      url=excluded.url,
      repository_url=excluded.repository_url,
      category=excluded.category,
      description=excluded.description,
      version=coalesce(excluded.version,analytics_projects.version),
      modified_at=now(),
      analytics_enabled=case when analytics_projects.status='ARCHIVED' then true else analytics_projects.analytics_enabled end,
      status=case when analytics_projects.status='ARCHIVED' then 'PENDING' else excluded.status end,
      allowed_origins=excluded.allowed_origins,
      map_metadata=excluded.map_metadata;
    seen := array_append(seen,node_id);
    synced := synced+1;
  end loop;
  update public.analytics_projects
  set status='ARCHIVED',analytics_enabled=false,modified_at=now()
  where source_node_id <> all(seen) and status <> 'ARCHIVED';
  return synced;
end $$;

revoke all on function analytix_private.sync_projects_from_map(jsonb) from public,anon,authenticated;
revoke all on function analytix_private.slugify(text) from public,anon,authenticated;
revoke all on function analytix_private.map_sync_trigger() from public,anon,authenticated;
