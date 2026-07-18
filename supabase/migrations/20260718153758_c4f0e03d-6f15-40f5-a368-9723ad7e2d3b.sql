
create policy "docs_bucket_owner_select" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (auth.uid()::text = (storage.foldername(name))[1]));
create policy "docs_bucket_owner_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and (auth.uid()::text = (storage.foldername(name))[1]));
create policy "docs_bucket_owner_update" on storage.objects for update to authenticated
  using (bucket_id = 'documents' and (auth.uid()::text = (storage.foldername(name))[1]))
  with check (bucket_id = 'documents' and (auth.uid()::text = (storage.foldername(name))[1]));
create policy "docs_bucket_owner_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and (auth.uid()::text = (storage.foldername(name))[1]));
create policy "docs_bucket_admin_select" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and public.has_role(auth.uid(), 'admin'));
