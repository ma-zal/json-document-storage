JSON Document Storage
=====================

TODO overview


Authorization
-------------

All JSON documents are free to read over the API. If some update/edit is needes, each JSON document can be protected
by `write password`. Its a optional secret entered during document creation, and it is required later for any document change. If no write password is entered, then document can be updated by anybody, who knows the application URL (usable on private network).

`Write password` of each document can be updated anytime by entering the new password into documentation edit form before document save.

### Technicalities

App is designed to be absolutely standalone. No special external authorization mechanism (like AD) is needed.

HTTPS is highly recommended in case a `write password` is used. It is because password is being sent during all document updates unprotected via HTTP header `Authorization: Bearer base64(write_password)`.

HTTPS webserver is not implemented in the app. You need to implement HTTPS gateway by reverse proxy (like Apache, Nginx).

If 3rd party reverse proxy is being used, you can protect anyhow a document changing by protecting of following URLs:

 - /api/manage/*
 - /manage/*
 