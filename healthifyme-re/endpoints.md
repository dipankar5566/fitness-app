# HealthifyMe v31.7 Retrofit endpoints (731, excl. Stream Chat)

| Verb | Path | Params | Returns | Interface.method |
|---|---|---|---|---|
| POST | `None` | @Url String, @Body j | (Stringj)Lio/reactivex/b0<Lretrofit2/Response<InternalPaymentResponse>;>; | a0.m |
| GET | `None` | @Url String | a | b0.b |
| GET | `None` | @Url String | (String)Lio/reactivex/b0<j>; | b0.c |
| GET | `None` | @Url String | (String)Lretrofit2/Call<j>; | b0.d |
| GET | `None` | @Url String | (String)Lretrofit2/Call<j>; | h.d |
| PUT | `None` | @Url String, @Body j | (Stringj)Lretrofit2/Call<j>; | h.e |
| POST | `None` | @Url String, @Body j | (Stringj)Lretrofit2/Call<j>; | h.g |
| GET | `None` | @Url String, @Query(activity_type) String, @Query(time_window) String, @Query(offset) I, @Query(limit) I, @Query(around_user) I, @Query(random) I | (StringStringStringIIII)Lretrofit2/Call<LeaderboardData>; | p.c |
| POST | `None` | @Url String, @Body l | (Stringl)Lio/reactivex/b0<c>; | a.a |
| POST | `None` | @Url String, @Body l | a | a.b |
| POST | `None` | @Url String, @Body l | a | c.a |
| POST | `None` | @Url String, @Body l | (Stringl)Lio/reactivex/b0<f>; | c.b |
| GET | `None` | @Url String | (String)Lio/reactivex/b0<Lretrofit2/Response<Ljava/util/List<a0>;>;>; | k.a |
| DELETE | `None` | @Url String | (String)Lio/reactivex/s<j>; | b.d |
| POST | `None` | @Url String, @PartMap Map, @Part MultipartBody$Part | (StringLjava/util/Map<StringRequestBody>;MultipartBody$Part)Lretrofit2/Call<j>; | b.j |
| POST | `None` | @Url String, @PartMap Map | (StringLjava/util/Map<StringRequestBody>;)Lretrofit2/Call<j>; | b.n |
| POST | `account/become/` | @Body j | (j)Lretrofit2/Call<j>; | a0.R |
| POST | `account/device/logout/` | @Body LogoutUserPostBody | (LogoutUserPostBody)Lretrofit2/Call<Void>; | a0.B |
| GET | `account/email/resend/` |  | a | a0.I |
| POST | `account/facebook/login/` | @Body b | (b)Lio/reactivex/b0<Lretrofit2/Response<j>;>; | g$a.i |
| GET | `account/firebase/tokens/` |  | ()Lio/reactivex/b0<Lretrofit2/Response<FirebaseTokens>;>; | a0.T |
| POST | `account/firebase_login/` |  | ()Lretrofit2/Call<FireBaseResponse>; | m.i |
| POST | `account/google/login/` | @Query(format) String, @Query(vc) I, @Body d | (StringId)Lio/reactivex/b0<Lretrofit2/Response<j>;>; | g$a.c |
| POST | `account/login/` | @Query(vc) I, @Body e | (Ie)Lio/reactivex/b0<Lretrofit2/Response<f>;>; | g$a.f |
| POST | `account/send/email_verification` | @Body ChangeEmailPostData | (ChangeEmailPostData)Lio/reactivex/b0<Lretrofit2/Response<ChangeEmailResponse>;>; | a0.U |
| POST | `account/signup/` | @Query(vc) I, @Body m | (Im)Lio/reactivex/b0<Lretrofit2/Response<n>;>; | g$a.e |
| POST | `account/signup/` | @Query(vc) I, @Body m | (Im)Lio/reactivex/b0<Lretrofit2/Response<BookSlotWithSignUpResponse>;>; | q$a.e |
| GET | `account/verified/` |  | ()Lio/reactivex/b0<IsVerifiedResponse>; | a0.D |
| POST | `accounts/password/reset/` | @Field(email) String | (String)Lio/reactivex/b0<Lretrofit2/Response<ResponseBody>;>; | g$a.g |
| POST | `activity-tracker/connect` | @Body a | a | a.d |
| POST | `activity-tracker/disconnect` | @Body GenericDeviceDisconnectData | a | a0.f |
| POST | `activity-tracker/disconnect` | @Body a | a | a.f |
| GET | `address-collection/collect-address` |  | ()Lio/reactivex/b0<a>; | a.b |
| GET | `address-collection/config` |  | ()Lio/reactivex/b0<AddressCollectionConfig>; | a.c |
| POST | `address-collection/products` | @Body g | (g)Lio/reactivex/b0<f>; | a.d |
| GET | `address-collection/products` | @Query(pro_product_name) String | (String)Lio/reactivex/b0<AllProductAddress>; | a.e |
| GET | `amadeus/coach-handoff/questions/` |  | ()Lio/reactivex/b0<Lretrofit2/Response<Ljava/util/List<CoachAnswer>;>;>; | d$a.a |
| POST | `amadeus/coach-handoff/questions/` | @Body c | (c)Lio/reactivex/b0<Lretrofit2/Response<d>;>; | d$a.q |
| GET | `amadeus/coach-handoff/questions/{q_id}` | @Path(q_id) I | (I)Lio/reactivex/b0<Lretrofit2/Response<CoachAnswer>;>; | d$a.o |
| POST | `/api/v1/account/set-password/` | @Body SetPasswordRequest | (SetPasswordRequest)Lio/reactivex/b0<Lretrofit2/Response<SetPasswordResponse>;>; | a0.g |
| GET | `/api/v1/ai_diet_plan/preferences` |  | (Lkotlin/coroutines/Continuation<-PreferencesData>;)Object | a.a |
| GET | `/api/v1/ai_diet_plan_guide/current` |  | (Lkotlin/coroutines/Continuation<-a>;)Object | a.p |
| POST | `/api/v1/ai_diet_plan_guide/generate` |  | (Lkotlin/coroutines/Continuation<-Unit>;)Object | a.h |
| GET | `/api/v1/ai_diet_plan_guide/modes` |  | (Lkotlin/coroutines/Continuation<-GuideSelectionData>;)Object | a.m |
| POST | `/api/v1/ai_diet_plan_guide/save_mode` | @Body GuideSelectionData$CurrentGuideType | (GuideSelectionData$CurrentGuideTypeLkotlin/coroutines/Continuation<-Unit>;)Object | a.f |
| GET | `/api/v1/ai_diet_plan_guide/status` |  | (Lkotlin/coroutines/Continuation<-l>;)Object | a.g |
| GET | `/api/v1/app_config/webview_bottomsheet_config` | @Query(key) String | (StringLkotlin/coroutines/Continuation<-Ljava/util/Map<Stringa>;>;)Object | e.a |
| GET | `/api/v1/cgm/config/` |  | ()Lio/reactivex/b0<c>; | c.b |
| GET | `/api/v1/cgm/override/url` |  | ()Lio/reactivex/b0<f>; | c.a |
| GET | `/api/v1/cgm/scores` | @Query(date) String | (String)Lio/reactivex/b0<v>; | c.g |
| POST | `/api/v1/dashboard/diy/meal/ai-dietplan/edit/` | @Body p | (pLkotlin/coroutines/Continuation<-q>;)Object | a.r |
| POST | `/api/v1/dashboard/diy/meal/ai-dietplan/edit/` | @Body o | (oLkotlin/coroutines/Continuation<-q>;)Object | a.t |
| GET | `/api/v1/dashboard/diy/meal/ai-dietplan/edit/options` | @Query(request_id) String, @Query(meal_type) I, @Query(date) String | (StringIStringLkotlin/coroutines/Continuation<-q>;)Object | a.b |
| POST | `/api/v1/dashboard/diy/meal/ai-dietplan/generate-and-store/` | @Body j | (jLkotlin/coroutines/Continuation<-Unit>;)Object | a.j |
| GET | `/api/v1/dashboard/diy/meal/ai-dietplan/get-by-request/` | @Query(request_id) String | (StringLkotlin/coroutines/Continuation<-e>;)Object | a.d |
| GET | `/api/v1/dashboard/diy/meal/ai-dietplan/latest-status-by-date/` | @Query(date) String | (StringLkotlin/coroutines/Continuation<-g>;)Object | a.e |
| POST | `/api/v1/dashboard/diy/meal/ai-dietplan/meal/like-toggle/` | @Body m | (mLkotlin/coroutines/Continuation<-Unit>;)Object | a.o |
| POST | `/api/v1/dashboard/diy/meal/ai-dietplan/orchestrator/copy/` | @Body d | (dLkotlin/coroutines/Continuation<-Unit>;)Object | a.k |
| POST | `/api/v1/dashboard/diy/meal/ai-dietplan/orchestrator/generate-and-store/` | @Body k | (kLkotlin/coroutines/Continuation<-v>;)Object | a.n |
| GET | `/api/v1/dashboard/diy/meal/ai-dietplan/orchestrator/latest-status-by-date/` | @Query(date) String | (StringLkotlin/coroutines/Continuation<-v>;)Object | a.q |
| GET | `/api/v1/dashboard/diy/meal/ai-dietplan/orchestrator/poll-status/` | @Query(orchestrator_request_id) String | (StringLkotlin/coroutines/Continuation<-v>;)Object | a.c |
| GET | `/api/v1/dashboard/diy/meal/ai-dietplan/poll-status-by-request/` | @Query(request_id) String | (StringLkotlin/coroutines/Continuation<-g>;)Object | a.i |
| POST | `/api/v1/dashboard/diy/meal/ai-dietplan/regenerate-and-store/` | @Body t | (tLkotlin/coroutines/Continuation<-Unit>;)Object | a.l |
| POST | `/api/v1/dashboard/diy/meal/ai-dietplan/save-edited/` | @Body u | (uLkotlin/coroutines/Continuation<-Unit>;)Object | a.s |
| POST | `api/v1/dataingestor/app_events` | @Query(event_name) String, @Body b | a | a.a |
| POST | `api/v1/dataingestor/app_events` | @Query(event_name) String, @Body c | a | a.b |
| POST | `api/v1/dataingestor/app_events` | @Query(event_name) String, @Body b | (StringbLkotlin/coroutines/Continuation<-Unit>;)Object | a.c |
| POST | `api/v1/dataingestor/events?source=food_search` | @Body n0$c | a | j.j |
| GET | `/api/v1/device/more_tab` |  | (Lkotlin/coroutines/Continuation<-Lretrofit2/Response<g>;>;)Object | a.a |
| GET | `/api/v1/ed/highlights/latest_highlight` |  | ()Lio/reactivex/b0<b>; | a.a |
| GET | `/api/v1/expertconnect/insurance/vertical-video-player/` |  | (Lkotlin/coroutines/Continuation<-b>;)Object | p.a |
| GET | `/api/v1/external-coach/appointments` |  | (Lkotlin/coroutines/Continuation<-h>;)Object | a.f |
| GET | `/api/v1/external-coach/appointments/cancel/` | @Query(appointment_id) J | (JLkotlin/coroutines/Continuation<-o>;)Object | a.b |
| POST | `/api/v1/external-coach/appointments/cancel/` | @Body c | (cLkotlin/coroutines/Continuation<-Unit>;)Object | a.d |
| GET | `/api/v1/external-coach/call_summary` | @Query(id) J | (JLkotlin/coroutines/Continuation<-n>;)Object | a.h |
| GET | `/api/v1/external-coach/slots` | @Query(expert_id) I, @Query(consultation_id) String | (IStringLkotlin/coroutines/Continuation<-l>;)Object | a.e |
| POST | `/api/v1/external-coach/slots/book` | @Body g | (gLkotlin/coroutines/Continuation<-Unit>;)Object | a.c |
| POST | `/api/v1/external-coach/slots/book` | @Body b | (bLkotlin/coroutines/Continuation<-Unit>;)Object | a.g |
| GET | `/api/v1/external-coach/tab` |  | (Lkotlin/coroutines/Continuation<-p>;)Object | a.a |
| GET | `/api/v1/foodlog/lookback/` |  | ()Lio/reactivex/b0<FoodLogLookBackResponse>; | j.a |
| GET | `/api/v1/foodlog/lookback/` | @Query(date) String | (String)Lio/reactivex/b0<FoodLogLookBackResponse>; | j.d |
| GET | `/api/v1/freemium/dashboard/lock` |  | (Lkotlin/coroutines/Continuation<-a>;)Object | b.a |
| GET | `/api/v1/freemium/get_tag_and_lock_info` | @Query(feature_types) List | (Ljava/util/List<String>;Lkotlin/coroutines/Continuation<-b>;)Object | c.a |
| GET | `api/v1/global/region/` | @Query(email) String, @Query(phone_number) String | (StringString)Lio/reactivex/b0<AuthRegionLookupHelper$a>; | AuthRegionLookupHelper$b.a |
| GET | `/api/v1/next_gen/activity/insight` | @Query(date) String, @Query(insight_type) String, @Query(insight_subtype) String | (StringStringStringLkotlin/coroutines/Continuation<-h>;)Object | a.b |
| GET | `/api/v1/next_gen/activity/state` | @Query(insight_id) J | (JLkotlin/coroutines/Continuation<-i>;)Object | b.b |
| GET | `/api/v1/next_gen/activity/state/info` | @Query(date) String, @Query(insight_type) String, @Query(insight_subtype) String | (StringStringStringLkotlin/coroutines/Continuation<-j>;)Object | b.a |
| POST | `/api/v1/next_gen/user/dismiss_banner` | @Body b0 | (b0Lkotlin/coroutines/Continuation<-Unit>;)Object | a.l |
| POST | `api/v1/oneconnect` | @Body j | a | c.d |
| GET | `/api/v1/plans_tab/info/` | @Query(type) String | (StringLkotlin/coroutines/Continuation<-a>;)Object | a.a |
| GET | `/api/v1/plans_tab/tab/` |  | (Lkotlin/coroutines/Continuation<-a>;)Object | b.a |
| POST | `/api/v1/pro-product/status/` | @Body h | (hLkotlin/coroutines/Continuation<-Lretrofit2/Response<Unit>;>;)Object | a.a |
| GET | `/api/v1/pro_onboarding/configs` | @Query(onboarding_keys) List | (Ljava/util/List<String>;)Lio/reactivex/b0<j>; | c.d |
| POST | `/api/v1/pro_onboarding/done` | @Body k | a | c.h |
| GET | `/api/v1/question/flow/options/default-selected?question_type=38` |  | ()Lio/reactivex/b0<d>; | a.c |
| POST | `/api/v1/snap/manual/notifications` |  | (Lkotlin/coroutines/Continuation<-Unit>;)Object | b.v |
| GET | `/api/v1/snap/photo-gallery` | @Query(cursor) Long, @Query(limit) I | (LongILkotlin/coroutines/Continuation<-b>;)Object | a.a |
| GET | `/api/v1/timeseries/steps/histogram` | @Query(sync_token) J | (J)Lio/reactivex/b0<f0>; | m.a |
| POST | `/api/v1/timeseries/steps/save-logs` | @Body i0 | a | m.b |
| POST | `/api/v1/tracker/sync-wrapper` | @Body j | (jLkotlin/coroutines/Continuation<-c>;)Object | e.K |
| POST | `/api/v1/tracker/sync-wrapper` | @Body j | (j)Lio/reactivex/b0<c>; | e.V |
| GET | `/api/v1/user/redirect/deeplink` | @Query(source) String | (String)Lio/reactivex/b0<a>; | d.a |
| POST | `/api/v1/user/sensor/replace/` | @Body d | (d)Lio/reactivex/b0<s>; | a.Y |
| GET | `/api/v1/user/symptoms` |  | (Lkotlin/coroutines/Continuation<-AllSymptoms>;)Object | d.a |
| POST | `/api/v1/user/symptoms/track` | @Body SymptomTrackPostBody | (SymptomTrackPostBodyLkotlin/coroutines/Continuation<-SymptomTrack>;)Object | d.b |
| POST | `/api/v1/user/symptoms/track/delete` | @Body a | (aLkotlin/coroutines/Continuation<-Unit>;)Object | d.c |
| GET | `/api/v1/user_paths/days/today` |  | (Lkotlin/coroutines/Continuation<-a>;)Object | a.b |
| POST | `/api/v1/user_paths/goals/status` | @Body b | (bLkotlin/coroutines/Continuation<-Unit>;)Object | a.a |
| GET | `/api/v2/cgm/insights` | @Query(date) String, @Query(image_width) I, @Query(image_height) I | (StringII)Lio/reactivex/b0<d>; | c.i |
| GET | `/api/v2/cgm/predictive_glucose_graph` |  | (Lkotlin/coroutines/Continuation<-l>;)Object | a.j |
| POST | `api/v2/dataingestor/ingest` | @Body c | (c)Lio/reactivex/b0<Lretrofit2/Response<j>;>; | a$a.a |
| POST | `/api/v2/expert_connect/migrate-user` | @Body a | (a)Lio/reactivex/b0<Lretrofit2/Response<Object>;>; | a.c |
| GET | `/api/v2/food/food_from_barcode` | @Query(barcode) List | (Ljava/util/List<String>;Lkotlin/coroutines/Continuation<-c>;)Object | b.r |
| POST | `/api/v2/infra/config/app_configs/` | @Body ConfigKeys | (ConfigKeysLkotlin/coroutines/Continuation<-a>;)Object | a.a |
| POST | `/api/v2/infra/config/app_configs/` | @Body a | (aLkotlin/coroutines/Continuation<-a>;)Object | q$a.d |
| POST | `/api/v2/infra/config/app_configs/` | @Body b | (bLkotlin/coroutines/Continuation<-PhotoTaggingConfig>;)Object | a.b |
| POST | `/api/v2/infra/config/app_configs/` | @Body a | (aLkotlin/coroutines/Continuation<-b>;)Object | a.b |
| POST | `/api/v2/infra/config/app_configs/` | @Body a | (aLkotlin/coroutines/Continuation<-b>;)Object | c.b |
| POST | `/api/v2/infra/config/app_configs/` | @Body a | (aLkotlin/coroutines/Continuation<-a>;)Object | b.a |
| POST | `/api/v2/infra/config/app_configs/` | @Body b | (b)Lio/reactivex/b0<Ljava/util/HashMap<Stringb>;>; | a.O |
| POST | `/api/v2/infra/config/app_configs/` | @Body b | (b)Lio/reactivex/b0<Ljava/util/HashMap<Stringq>;>; | a.t |
| POST | `/api/v2/infra/config/app_configs/` | @Body b | (b)Lio/reactivex/b0<Ljava/util/HashMap<Stringg>;>; | a.a |
| POST | `/api/v2/insights/feedback` | @Body j | (jLkotlin/coroutines/Continuation<-Unit>;)Object | a.a |
| POST | `/api/v2/referral/` | @Body a | (aLkotlin/coroutines/Continuation<-g>;)Object | k.d |
| GET | `/api/v2/ria/loading/screen/info` |  | (Lkotlin/coroutines/Continuation<-a>;)Object | a.a |
| GET | `/api/v2/ria/personas` |  | (Lkotlin/coroutines/Continuation<-RiaPersonalityInfo>;)Object | a.a |
| POST | `/api/v2/ria/personas/user` | @Body a | (aLkotlin/coroutines/Continuation<-Unit>;)Object | a.b |
| GET | `/api/v2/snap/get_tracked_foods` |  | (Lkotlin/coroutines/Continuation<-n0>;)Object | b.C |
| GET | `/api/v2/snap/get_tracked_foods` | @Query(uuid) String | (StringLkotlin/coroutines/Continuation<-n0>;)Object | b.u |
| GET | `/api/v2/snap/get_tracked_foods` | @Query(image_id) J | (JLkotlin/coroutines/Continuation<-n0>;)Object | b.y |
| GET | `/api/v2/snap/get_tracked_foods` | @Query(date) String, @Query(meal_type) String | (StringStringLkotlin/coroutines/Continuation<-n0>;)Object | b.z |
| POST | `/api/v2/snap/track` | @Body j | (jLkotlin/coroutines/Continuation<-Unit>;)Object | b.D |
| POST | `/api/v2/snap/upload` | @Body RequestBody | (RequestBodyLkotlin/coroutines/Continuation<-g0>;)Object | b.i |
| POST | `/api/v2/user/feature_activity_log/` | @Body c | (cLkotlin/coroutines/Continuation<-Lretrofit2/Response<Unit>;>;)Object | a.a |
| GET | `/api/v2/user/symptoms/logs/list/` | @Query(sync_token) String | (StringLkotlin/coroutines/Continuation<-SymptomTrackResponse>;)Object | d.d |
| POST | `/api/v3/otp/email/non-logged-in/send/app` | @Body k | (k)Lio/reactivex/b0<Lretrofit2/Response<j>;>; | g$a.h |
| POST | `/api/v3/otp/sms/non-logged-in/send/app` | @Query(phone_number) String, @Query(for_logged_in_user) I, @Body j | (StringIj)Lio/reactivex/b0<Lretrofit2/Response<j>;>; | g$a.b |
| GET | `/api/v3/user/compute/target_segment` |  | (Lkotlin/coroutines/Continuation<-b>;)Object | a.c |
| GET | `/api/v4/expert_connect/expert_selection/filters` |  | ()Lio/reactivex/b0<g>; | a.a |
| POST | `/api/v4/expert_connect/experts/list/eligible/` | @Body l | (l)Lio/reactivex/b0<i>; | a.b |
| POST | `/api/v5/user/address` | @Body b | a | a.f |
| GET | `/api/v6/referrals/details/` |  | (Lkotlin/coroutines/Continuation<-b0>;)Object | k.a |
| POST | `/api/v6/referrals/expert-referral-url` | @Body b | (bLkotlin/coroutines/Continuation<-m>;)Object | k.b |
| GET | `/api/v6/referrals/history` |  | (Lkotlin/coroutines/Continuation<-d0>;)Object | k.c |
| GET | `app_actions/all` | @Query(sync_token) String | (String)Lio/reactivex/b0<AppActionResponse>; | c.a |
| GET | `app_config/all/` |  | ()Lio/reactivex/b0<AppConfigData>; | d.a |
| GET | `app_config/overrides` |  | ()Lio/reactivex/b0<Lretrofit2/Response<e0>;>; | q.a |
| GET | `app_config/overrides?is_login=true` |  | ()Lio/reactivex/b0<Lretrofit2/Response<e0>;>; | q.g |
| GET | `app_config/story_set` | @Query(story_set_id) I | (I)Lio/reactivex/b0<StorySetResponse>; | c.b |
| POST | `app_config/story_set/actions` | @Body c | a | c.a |
| GET | `app_config/swipe_banners` | @Query(screen_name) String | (String)Lio/reactivex/b0<SwipeBannerData>; | c.a |
| GET | `app_config/webview_config/` | @Query(key) String | String)Lio/reactivex/b0<Lretrofit2/Response<Ljava/util/Map<StringLjava/util/List<i>;>;>;>; | f$a.a |
| GET | `app_dashboard/` |  | ()Lio/reactivex/b0<DashboardApiResponse>; | g.a |
| GET | `app_dashboard/` |  | ()Lio/reactivex/b0<OnboardingTrackerResponse>; | c.a |
| POST | `app_dashboard/` | @Body a | (a)Lio/reactivex/b0<OnboardingTrackerResponse>; | c.b |
| GET | `app_dashboard/` |  | (Lkotlin/coroutines/Continuation<-SnapPendingReviewResponse>;)Object | b.o |
| GET | `auth-user/onboarding/flow-info` | @Query(pre_auth_key) String, @Query(returning_user_flow) String | (StringString)Lio/reactivex/b0<Lretrofit2/Response<OnboardingFlowInfo>;>; | q$a.f |
| GET | `/blog/wp-json/wp/v2/posts/{id}` | @Path(id) String | (String)Lio/reactivex/b0<Lretrofit2/Response<a>;>; | b.a |
| POST | `body_measurement/logs/bulk_upload` | @Body j | (j)Lio/reactivex/b0<Lretrofit2/Response<j>;>; | d.b |
| GET | `body_measurement/logs/sync/` | @Query(sync_token) J | (J)Lio/reactivex/b0<Lretrofit2/Response<d>;>; | d.c |
| POST | `body_measurement/logs/{measurement_id}/` | @Path(measurement_id) I, @Body e | (Ie)Lio/reactivex/b0<Lretrofit2/Response<j>;>; | d.d |
| GET | `body_measurement/measurements/list/relevant/` |  | ()Lio/reactivex/b0<Lretrofit2/Response<Ljava/util/List<b>;>;>; | d.a |
| POST | `body_measurement/progress_photo_bottom_sheet/should_show` |  | ()Lio/reactivex/b0<g>; | b.k |
| GET | `body_measurement/weight_metrics` | @Query(max_date) String, @Query(limit) I | (StringI)Lio/reactivex/b0<l>; | b.e |
| GET | `body_measurement/weight_metrics/details` | @Query(date) String | (String)Lio/reactivex/b0<k>; | b.i |
| GET | `body_measurement/weight_metrics/graph/data` | @Query(measure_id) I, @Query(limit) I | (IILkotlin/coroutines/Continuation<-j1>;)Object | a.k |
| GET | `body_measurement/weight_metrics/graph/data` | @Query(measure_id) Integer, @Query(max_date) String, @Query(limit) Integer | (IntegerStringInteger)Lio/reactivex/b0<m$e>; | b.h |
| GET | `body_measurement/weight_metrics/graph/info` | @Query(limit) Integer | (Integer)Lio/reactivex/b0<m>; | b.f |
| GET | `booking/booking/info` | @Query(slot_id) I | (ILkotlin/coroutines/Continuation<-a>;)Object | a.a |
| POST | `booking/consultation/call` | @Body ArrayMap | otlin/coroutines/Continuation<-Lretrofit2/Response<BookConsultationCallResponse>;>;)Object | c.a |
| GET | `booking/free-user-booking-eligibility/` |  | ()Lio/reactivex/b0<b>; | b.a |
| POST | `booking/multi_coach/book/` | @Body g | (gLkotlin/coroutines/Continuation<-Lretrofit2/Response<BookingResponseConfig>;>;)Object | a.f |
| GET | `booking/multi_coach/booking/info` | @Query(slot_key) String | tringLkotlin/coroutines/Continuation<-Lretrofit2/Response<BookingResponseConfig>;>;)Object | a.b |
| GET | `booking/multi_coach/info/` |  | (Lkotlin/coroutines/Continuation<-Lretrofit2/Response<e>;>;)Object | a.g |
| POST | `booking/multi_coach/reschedule/` | @Body i | (iLkotlin/coroutines/Continuation<-Lretrofit2/Response<BookingResponseConfig>;>;)Object | a.d |
| POST | `booking/multi_coach/slots/all` | @Body h | (hLkotlin/coroutines/Continuation<-Lretrofit2/Response<d>;>;)Object | a.e |
| GET | `booking/multi_coach/slots/me/` |  | ()Lio/reactivex/b0<BookingHistoryResponse>; | v.a |
| GET | `booking/preference/expert/{expert_id}` | @Path(expert_id) I | (I)Lio/reactivex/b0<Ljava/util/List<BookingCustomSlot>;>; | e.b |
| POST | `booking/preference/expert/{expert_id}` | @Path(expert_id) I, @Body BookingCustomSlot | (IBookingCustomSlot)Lio/reactivex/s<Lretrofit2/Response<l>;>; | e.d |
| GET | `booking/preference/expert/{expert_id}` | @Path(expert_id) I | oroutines/Continuation<-Lretrofit2/Response<Ljava/util/List<BookingCustomSlot>;>;>;)Object | a.a |
| POST | `booking/preference/expert/{expert_id}` | @Path(expert_id) I, @Body BookingCustomSlot | (IBookingCustomSlotLkotlin/coroutines/Continuation<-Lretrofit2/Response<l>;>;)Object | a.c |
| GET | `booking/preference/{expert_id}/` | @Path(expert_id) String | (String)Lio/reactivex/s<Ljava/util/List<BookingUserPreference>;>; | e.a |
| POST | `booking/preference/{expert_id}/` | @Path(expert_id) String, @Body HashMap | java/util/HashMap<StringString>;)Lio/reactivex/s<Ljava/util/List<BookingUserPreference>;>; | e.c |
| GET | `booking/preferred-day-time/` |  | ()Lio/reactivex/b0<Ljava/util/List<DaySlots>;>; | b.f |
| POST | `booking/real-time/book` | @Body a | (a)Lio/reactivex/b0<Lretrofit2/Response<b>;>; | q$a.b |
| GET | `booking/real-time/book` | @Query(source) String | (String)Lio/reactivex/b0<a>; | c.a |
| POST | `booking/reschedule/{from_slot_id}/{to_slot_id}/` | @Path(from_slot_id) I, @Path(to_slot_id) I, @Body ReschedulePostDataWithoutSourceId | (IIReschedulePostDataWithoutSourceId)Lretrofit2/Call<BookingSlotResponse>; | a0.M |
| POST | `booking/reschedule/{from_slot_id}/{to_slot_id}/` | @Path(from_slot_id) I, @Path(to_slot_id) I, @Body ReschedulePostData | (IIReschedulePostData)Lretrofit2/Call<BookingSlotResponse>; | a0.X |
| GET | `booking/slots/all/` | @Query(expert_username) String, @Query(source_id) Integer | (StringInteger)Lio/reactivex/b0<Ljava/util/List<BookingSlot>;>; | a0.l |
| POST | `booking/slots/book` | @Body a | (a)Lio/reactivex/b0<Lretrofit2/Response<j>;>; | b.b |
| POST | `booking/slots/book` | @Body c | (c)Lio/reactivex/b0<Lretrofit2/Response<d>;>; | q$a.g |
| POST | `booking/slots/book/` | @Body BookSlotDataWithoutSourceId | (BookSlotDataWithoutSourceId)Lio/reactivex/b0<Lretrofit2/Response<Void>;>; | a0.e |
| POST | `booking/slots/book/` | @Body BookSlotDataWithoutSourceId | (BookSlotDataWithoutSourceId)Lretrofit2/Call<BookingSlotResponse>; | a0.i |
| POST | `booking/slots/book/` | @Body BookSlotData | (BookSlotData)Lretrofit2/Call<BookingSlotResponse>; | a0.w |
| POST | `booking/slots/book/guaranteed/` | @Body BookSlotData | (BookSlotData)Lio/reactivex/b0<Lretrofit2/Response<BookingSlotResponse>;>; | a0.S |
| POST | `booking/slots/book/guaranteed/` | @Body BookSlotData | (BookSlotData)Lretrofit2/Call<BookingSlotResponse>; | a0.x |
| POST | `booking/slots/book/guaranteed/` | @Body BookSlotData | (BookSlotData)Lio/reactivex/b0<BookingSlotResponse>; | a0.y |
| POST | `booking/slots/book/guaranteed/` | @Body a | (a)Lio/reactivex/b0<BookSlotApiResponse>; | a.a |
| GET | `booking/slots/real-time/` | @QueryMap Map, @Query(expert_type) List | (Ljava/util/Map<StringString>;Ljava/util/List<Integer>;)Lio/reactivex/b0<j>; | b.h |
| POST | `booking/slots/real-time/book/` | @Body d | (d)Lio/reactivex/b0<Lretrofit2/Response<e>;>; | b.c |
| POST | `branch/source` | @Body k | (k)Lio/reactivex/b0<j>; | i.a |
| GET | `cgm/config/` |  | (Lkotlin/coroutines/Continuation<-c>;)Object | a.f |
| GET | `cgm/event-history/` | @Query(query_text) String, @Query(date) String, @Query(range) String, @Query(sort_by) String, @Query(limit) Integer, @Query(offset) I | (StringStringStringStringIntegerI)Lio/reactivex/b0<i>; | a.f |
| GET | `cgm/event-history/search/` | @Query(query_text) String | (String)Lio/reactivex/b0<Ljava/util/List<j>;>; | a.h |
| POST | `cgm/log_raw_data` | @Body d0 | (d0)Lio/reactivex/b0<j>; | c.j |
| GET | `cgm/predictive_glucose_graph` |  | ()Lio/reactivex/b0<l>; | g.b |
| GET | `cgm/sensors_info` |  | (Lkotlin/coroutines/Continuation<-a>;)Object | a.a |
| GET | `cgm/tracker-tagging/fetch-cgm-log-details` | @Query(log_datetime) J, @Query(tracker_log_type) String, @Query(tagging_image) Boolean | (JStringBoolean)Lio/reactivex/b0<m>; | a.a0 |
| GET | `cgm/tracker-tagging/fetch-cgm-log-details` | @Query(log_datetime) J, @Query(tracker_log_type) String | (JStringLkotlin/coroutines/Continuation<-e>;)Object | b.H |
| POST | `cgm/tracker-tagging/image-notes` | @Body p | a | a.e |
| POST | `cgm/tracker-tagging/image-summary/` | @Body l | (l)Lio/reactivex/b0<k>; | a.a |
| GET | `cgm/tracker-tagging/pre-check` | @Query(cgm_log_id) String, @Query(cgm_timestamp) J, @Query(log_type) String | (StringJString)Lio/reactivex/b0<e>; | a.w |
| GET | `cgm/tracker-tagging/summary` | @Query(cgm_log_id) String, @Query(cgm_timestamp) J, @Query(image_width) I, @Query(image_height) I | (StringJII)Lio/reactivex/b0<c>; | a.d |
| POST | `cgm/tracker-tagging/tag-image` | @Body c | a | a.T |
| DELETE | `cgm/tracker-tagging/tag-image` | @Query(tagged_image_log_id) String | a | a.c |
| POST | `cgm/tracker-tagging/tag-logs` | @Body d | a | a.E |
| GET | `cgm/tracking` |  | ()Lio/reactivex/b0<l>; | a.Z |
| GET | `challenges/{challenge_id}` | @Path(challenge_id) String | (String)Lio/reactivex/b0<Lretrofit2/Response<c>;>; | c.a |
| GET | `challenges/{challenge_id}/progress` | @Path(challenge_id) String | (String)Lio/reactivex/b0<Lretrofit2/Response<b>;>; | c.b |
| POST | `challenges/{challenge_id}/register` | @Path(challenge_id) String | (String)Lio/reactivex/b0<Lretrofit2/Response<j>;>; | c.c |
| POST | `challenges/{challenge_id}/task/entry/submit` | @Path(challenge_id) String, @PartMap Map, @Part MultipartBody$Part | il/Map<StringRequestBody>;MultipartBody$Part)Lio/reactivex/b0<Lretrofit2/Response<Unit>;>; | d.b |
| POST | `/channels/{type}/{id}/file` | @Path(type) String, @Path(id) String, @Part MultipartBody$Part,  b | ltipartBody$Partb)Lio/getstream/chat/android/client/call/RetrofitCall<UploadFileResponse>; | h.a |
| POST | `/channels/{type}/{id}/image` | @Path(type) String, @Path(id) String, @Part MultipartBody$Part,  b | ltipartBody$Partb)Lio/getstream/chat/android/client/call/RetrofitCall<UploadFileResponse>; | h.b |
| GET | `coach/component/coach-group` |  | ()Lio/reactivex/b0<e>; | a.b |
| GET | `coach/ex-pro-tab` |  | ()Lio/reactivex/b0<d>; | a.d |
| GET | `coach/tab` |  | ()Lio/reactivex/b0<d>; | a.c |
| GET | `coach/tab/` |  | ()Lio/reactivex/b0<CoachTabInfo>; | a0.J |
| GET | `coach/tab/` |  | ()Lio/reactivex/b0<Lretrofit2/Response<a>;>; | a.a |
| GET | `collection/eligible/plan-info` |  | ()Lio/reactivex/b0<Lretrofit2/Response<y>;>; | t.d |
| GET | `collection/features` |  | ()Lio/reactivex/b0<Lretrofit2/Response<c>;>; | t.f |
| POST | `collection/switch` | @Body w | (w)Lio/reactivex/b0<Lretrofit2/Response<j>;>; | t.b |
| GET | `collection/{plan_id}/ui-info` | @Path(plan_id) I, @Query(key) String | (IString)Lio/reactivex/b0<x>; | t.a |
| GET | `config-user/settings/?key=timed_meal_tracking_config` |  | ()Lio/reactivex/s<MealTrackingConfig>; | a0.Q |
| GET | `config/settings/` | @Query(key) String | (String)Lio/reactivex/b0<j>; | z.a |
| GET | `config/settings/` | @Query(key) String | (String)Lio/reactivex/b0<ConfigSettingsData>; | z.b |
| GET | `config/settings/?key=consent_screen_config` |  | ()Lio/reactivex/b0<a>; | a.a |
| GET | `config/settings/?key=diy_infra` |  | (Lkotlin/coroutines/Continuation<-Lretrofit2/Response<c>;>;)Object | a.b |
| GET | `config/settings/?key=quizzer_infra` |  | ()Lio/reactivex/b0<q>; | h.f |
| GET | `config/settings/?key=workout_video_config` |  | ()Lio/reactivex/b0<e>; | a.c |
| GET | `config/settings?key=dp_food_tag_data` | @Query(meal_id) String | (String)Lio/reactivex/b0<Lretrofit2/Response<l>;>; | d.c |
| POST | `corporate/challenge/join/` | @Body RegisterCorporateChallengePostBody | a | a0.s |
| GET | `corporate/options/` |  | ()Lretrofit2/Call<CorporateOptionsResponse>; | a0.v |
| GET | `corporate/rewards/` |  | ()Lretrofit2/Call<CorpRewardsPojo>; | f.a |
| GET | `corporate/winners/` |  | ()Lretrofit2/Call<CorpWinnersPojo>; | f.b |
| POST | `cp_goal/goal/gratification` | @Body f | a | a.d |
| GET | `cp_goal/user/cp_goal` | @Query(goal_id) Integer, @Query(completion_log_id) Integer | (IntegerInteger)Lio/reactivex/b0<b>; | a.e |
| POST | `create` | @Header(appKey) String, @Header(fingerPrint) String, @Body CreateInstallationModel | (StringStringCreateInstallationModel)Lretrofit2/Call<Ljava/util/Map<StringObject>;>; | d.a |
| POST | `csm/invoice/send/` | @Body GetInvoicePostData | (GetInvoicePostData)Lio/reactivex/b0<Lretrofit2/Response<Void>;>; | a0.q |
| GET | `customer_support` |  | ()Lio/reactivex/b0<Lretrofit2/Response<FAQIssueMainData>;>; | c.b |
| GET | `device/budget/messages/` |  | ()Lio/reactivex/b0<Ljava/util/List<BudgetTemplate>;>; | g.b |
| GET | `device/messages/reminder/` |  | ()Lio/reactivex/b0<Lretrofit2/Response<Ljava/util/List<f>;>;>; | g.a |
| POST | `dietplan/rework/` | @Body b | (b)Lio/reactivex/b0<Lretrofit2/Response<Object>;>; | a0.A |
| POST | `dietplan/suggest_meal/` | @Body HealthySuggestionMealType | lthySuggestionMealType)Lio/reactivex/b0<Lretrofit2/Response<HealthySuggestionsResponse>;>; | n.a |
| GET | `dietplan/summary` |  | ()Lio/reactivex/b0<c>; | s.e |
| GET | `dietplan/user/{user_id}/note` | @Path(user_id) I | (I)Lio/reactivex/b0<Lretrofit2/Response<PlanNotes>;>; | b.a |
| GET | `diy/dietplan/likes/counts` | @Query(meal_type) I | (I)Lio/reactivex/b0<Lretrofit2/Response<s>;>; | d.e |
| GET | `diy/dietplan/list` | @Query(date) String, @Query(force_refresh) Boolean | (StringBoolean)Lio/reactivex/b0<Lretrofit2/Response<DiyDietPlanMeals>;>; | q.o |
| POST | `diy/dietplan/meal/feedback` | @Body List | (Ljava/util/List<e>;)Lio/reactivex/b0<Lretrofit2/Response<j>;>; | q.i |
| GET | `diy/dietplan/meals/liked` | @Query(meal_type) I | (I)Lio/reactivex/b0<Lretrofit2/Response<r>;>; | d.d |
| GET | `diy/dietplan/meals/options` | @Query(meal_type) I, @Query(meal_pref) I, @Query(page) I | (III)Lio/reactivex/b0<Lretrofit2/Response<r>;>; | d.g |
| GET | `diy/dietplan/meals/options` | @Query(meal_type) I, @Query(food_id) [J, @Query(meal_pref) I, @Query(page) I | (I[JII)Lio/reactivex/b0<Lretrofit2/Response<r>;>; | d.i |
| GET | `diy/dietplan/meals/{meal_id}` | @Path(meal_id) J | (J)Lio/reactivex/b0<Lretrofit2/Response<s>;>; | d.f |
| POST | `diy/dietplan/user-meals/{user_meal_id}/feedback/` | @Path(user_meal_id) J, @Body a, @Query(require_like_counts) Integer | (JaInteger)Lio/reactivex/b0<Lretrofit2/Response<s>;>; | q.h |
| GET | `diy/dietplan/user-meals/{user_meal_id}/meal/detail` | @Path(user_meal_id) J | (J)Lio/reactivex/b0<Lretrofit2/Response<s>;>; | d.b |
| GET | `diy/food/likes` | @Query(meal_type) Integer | (Integer)Lio/reactivex/b0<Lretrofit2/Response<p>;>; | d.a |
| POST | `diy/food/likes/analytics` | @Body a | a | q.c |
| GET | `diy/food/likes/category/more` | @Query(category) String, @Query(available_count) I, @Query(meal_type) Integer, @Query(preference_flow) Boolean, @Query(limit) Integer | (StringIIntegerBooleanInteger)Lio/reactivex/b0<Lretrofit2/Response<e>;>; | q.f |
| GET | `diy/food/likes/options` | @Query(page) I, @Query(meal_type) Integer, @Query(meal_pref) I | (IIntegerI)Lio/reactivex/b0<Lretrofit2/Response<c>;>; | q.k |
| POST | `diy/food/likes/reset` | @Body f | (f)Lio/reactivex/b0<Lretrofit2/Response<j>;>; | q.p |
| POST | `diy/food/likes/save` | @Body h | (h)Lio/reactivex/b0<Lretrofit2/Response<g>;>; | q.e |
| GET | `diy/food_search/es-global-foods/` | @Query(search_term) String, @Query(has_diy_recipe) Z | (StringZ)Lio/reactivex/b0<Lretrofit2/Response<Ljava/util/List<h>;>;>; | f.b |
| POST | `diy/invite/find_buddy` | @Body j | (j)Lio/reactivex/b0<j>; | b.b |
| GET | `diy/invite/info_config` |  | ()Lio/reactivex/b0<a>; | b.a |
| POST | `diy/invite/user` | @Body j | (j)Lio/reactivex/b0<Lretrofit2/Response<m>;>; | d.a |
| POST | `diy/meal/swap-food` | @Body h | (h)Lio/reactivex/b0<Lretrofit2/Response<j>;>; | c.b |
| GET | `diy/meal/swap-food/` | @Query(food_id_to_swap) J, @Query(user_meal_id) J, @Query(limit) I, @Query(available_count) I | (JJII)Lio/reactivex/b0<Lretrofit2/Response<e>;>; | c.c |
| GET | `diy/meal/swap-food/detail` | @Query(food_id_to_swap) J, @Query(user_meal_id) J, @Query(food_id_swapped_with) J, @Query(food_name_id_swapped_with) Long, @Query(food_name_swapped_with) String | (JJJLongString)Lio/reactivex/b0<Lretrofit2/Response<c>;>; | c.a |
| GET | `diy/meal/swap-food/detail` | @Query(food_id_to_swap) J, @Query(user_meal_id) J | (JJ)Lio/reactivex/b0<Lretrofit2/Response<c>;>; | c.d |
| GET | `diy/plans` | @Query(ucb_enabled) Z | (Z)Lio/reactivex/b0<Lretrofit2/Response<DiyPlansResponse>;>; | q.b |
| GET | `diy/plans` | @Query(intent) String, @Query(ucb_enabled) Z | (StringZ)Lio/reactivex/b0<Lretrofit2/Response<DiyPlansResponse>;>; | q.m |
| GET | `diy/recipe/categories` | @Query(category_id) String, @Query(page_num) Integer | (StringInteger)Lio/reactivex/b0<Lretrofit2/Response<i>;>; | f.a |
| GET | `diy/recipe/{id}/` | @Path(id) String | (String)Lio/reactivex/b0<Lretrofit2/Response<g>;>; | f.c |
| GET | `diy/share/content` | @Query(plan_name) String, @Query(date) String | (StringString)Lio/reactivex/b0<c>; | c.a |
| POST | `diy/share/status-update` | @Body e | a | c.b |
| GET | `diy/user/stats/` | @Query(date) String | (String)Lio/reactivex/b0<b>; | a.a |
| GET | `diy/user/stats/renewal` |  | ()Lio/reactivex/b0<a>; | c.a |
| GET | `diy/user_preferences/edit_preferences/config` |  | ()Lio/reactivex/b0<Lretrofit2/Response<l>;>; | t.e |
| GET | `doctor_consultation/my_doctor/` |  | ()Lio/reactivex/b0<a>; | a.a |
| POST | `events/messages/completed` | @Body a | a | b.a |
| GET | `events/messages/pending` |  | ()Lio/reactivex/b0<b>; | b.b |
| GET | `expert_connect/expert/info` | @Query(expert_id) I | (I)Lio/reactivex/b0<g>; | a.a |
| POST | `expert_connect/experts/add/` | @Body AssignExpertPostBody | (AssignExpertPostBody)Lio/reactivex/b0<Lretrofit2/Response<AssignExpertResponse>;>; | a0.G |
| GET | `expert_connect/experts/availability` |  | (Lkotlin/coroutines/Continuation<-g>;)Object | b.a |
| GET | `expert_connect/experts/bio/{expert_id}` | @Path(expert_id) I | (I)Lio/reactivex/b0<ExpertInfo>; | b.d |
| GET | `expert_connect/experts/info` | @Query(expert_usernames) List | (Ljava/util/List<String>;)Lio/reactivex/b0<b>; | d.c |
| GET | `expert_connect/experts/list/all/synced/` | @Query(sync_token) J | (J)Lio/reactivex/b0<Lretrofit2/Response<a>;>; | d.d |
| GET | `expert_connect/experts/list/allocated/` |  | ()Lio/reactivex/b0<Ljava/util/List<AllocatedExpertResponse>;>; | a.b |
| GET | `expert_connect/experts/list/allocated/` |  | ()Lretrofit2/Call<Ljava/util/List<AllocatedExpertResponse>;>; | d.b |
| GET | `expert_connect/experts/list/allocated/` |  | ()Lio/reactivex/b0<Ljava/util/List<AllocatedExpertResponse>;>; | d.g |
| GET | `expert_connect/experts/list/allocated/` |  | ()Lio/reactivex/b0<Lretrofit2/Response<Ljava/util/List<AllocatedExpertResponse>;>;>; | d.i |
| GET | `expert_connect/experts/list/by_source` | @Query(source) String | (String)Lio/reactivex/b0<Lretrofit2/Response<[ExpertMinimalInfo>;>; | h.f |
| GET | `expert_connect/experts/list/by_source` | @Query(source) String | (String)Lio/reactivex/b0<Lretrofit2/Response<[ExpertMinimalInfo>;>; | d.f |
| GET | `expert_connect/experts/list/eligible/` | @Query(expert_type) I | (I)Lretrofit2/Call<[ExpertMinimalInfo>; | h.c |
| GET | `expert_connect/experts/list/eligible/` | @Query(expert_type) Integer | (Integer)Lio/reactivex/b0<Lretrofit2/Response<[ExpertMinimalInfo>;>; | d.e |
| GET | `expert_connect/experts/list/eligible/` | @Query(is_for_display) I | (I)Lio/reactivex/b0<Lretrofit2/Response<[ExpertMinimalInfo>;>; | d.h |
| GET | `expert_connect/experts/list/eligible/` | @Query(expert_type) I, @Query(language_preferences) List, @QueryMap Map, @Query(is_migration) Z | (ILjava/util/List<Integer>;Ljava/util/Map<StringString>;Z)Lio/reactivex/b0<c>; | a.d |
| GET | `expert_connect/experts/list/free-consultation` | @QueryMap Map, @Query(expert_type) ArrayList | (Ljava/util/Map<StringString>;Ljava/util/ArrayList<Integer>;)Lio/reactivex/s<d>; | h.a |
| GET | `expert_connect/experts/list/free-consultation` | @Query(pool_type) String | (String)Lio/reactivex/b0<Lretrofit2/Response<d>;>; | h.b |
| GET | `expert_connect/experts/list/paid/consultation` | @Query(expert_id) Integer, @Query(expert_type) Integer, @Query(slot_info) Z | (IntegerIntegerZ)Lio/reactivex/b0<c>; | a.b |
| GET | `expert_connect/experts/list/paid/consultation` | @Query(expert_type) I, @Query(config_key_names) [String, @Query(slot_info) Z | (I[StringZ)Lio/reactivex/b0<b>; | a.d |
| GET | `expert_connect/list/migration_reason` |  | ()Lio/reactivex/b0<Ljava/util/List<b>;>; | a.a |
| GET | `expert_connect/recommend/free_consultation/` | @QueryMap HashMap | (Ljava/util/HashMap<StringString>;)Lio/reactivex/b0<FindExpertResponse>; | b.e |
| GET | `expert_connect/recommend/whatsapp_consultation` |  | ()Lio/reactivex/b0<a>; | c.a |
| POST | `expert_connect/redeemcoupon/` | @Body RedeemCoupon$RedeemCouponRequest | (RedeemCoupon$RedeemCouponRequest)Lretrofit2/Call<RedeemCoupon>; | a0.P |
| POST | `expert_connect/redeemcoupon/` | @Body RedeemCoupon$RedeemCouponRequest | (RedeemCoupon$RedeemCouponRequest)Lio/reactivex/b0<Lretrofit2/Response<RedeemCoupon>;>; | a0.n |
| POST | `expert_connect/whatsapp/expert/selected` | @Body d | a | c.b |
| GET | `features/availabilities` | @Query(device_id) String, @Query(bg) Z | (StringZ)Lio/reactivex/b0<Lretrofit2/Response<Ljava/util/Map<Stringg>;>;>; | f.c |
| POST | `feeds/clicked/{feed_id}` | @Path(feed_id) String | a | b.b |
| GET | `feeds/timeline/me/` | @Query(feed_id_offset) String, @Query(limit) I, @Query(source_ids) Set, @Query(exclude_source_ids) Set, @Query(liked_only) Z, @Query(show_custom_feeds) Z | StringILjava/util/Set<Integer>;Ljava/util/Set<Integer>;ZZ)Lio/reactivex/b0<FeedsResponse>; | b.c |
| DELETE | `feeds/{feed_id}/like` | @Path(feed_id) String | (String)Lio/reactivex/b0<FeedsLikeUnlikeResponse>; | b.d |
| POST | `feeds/{feed_id}/like` | @Path(feed_id) String | (String)Lio/reactivex/b0<FeedsLikeUnlikeResponse>; | b.e |
| GET | `feeds/{feed_id}/likes` | @Path(feed_id) String, @Query(start) I, @Query(limit) I | (StringII)Lio/reactivex/b0<LikeResponse>; | b.a |
| POST | `fitbit/disconnect/` |  | ()Lretrofit2/Call<Void>; | a0.a |
| POST | `fitbit/disconnect?tracker_type=sleep` |  | a | a.a |
| POST | `fitbit/sync` | @Body FitbitSyncPostBody | (FitbitSyncPostBody)Lretrofit2/Call<Void>; | a0.Y |
| POST | `fitbit/sync/` | @Body d | a | a.g |
| GET | `food-insights/daily-insights` | @Query(date) String | (String)Lio/reactivex/b0<Lretrofit2/Response<g>;>; | d$a.r |
| GET | `food/details` | @Query(food_id) J | (J)Lio/reactivex/b0<Lretrofit2/Response<b>;>; | k.b |
| POST | `food/log_predictor/next_foods` | @Body NextFoodApiPostBody | (NextFoodApiPostBody)Lio/reactivex/b0<Lretrofit2/Response<NextFoodApiResponse>;>; | j.i |
| GET | `food_tracker/screen_config` | @Query(meal_type) String, @Query(next_meal_type) String | (StringString)Lio/reactivex/b0<r>; | f.a |
| GET | `food_v2/autocomplete` | @Query(search_term) String | (StringLkotlin/coroutines/Continuation<-AIFoodResult>;)Object | a.a |
| POST | `food_v2/custom-food-search` | @Body AIFoodResult$FoodInfo | (AIFoodResult$FoodInfoLkotlin/coroutines/Continuation<-a>;)Object | a.b |
| POST | `food_v2/delete-custom-food` | @Body c0 | (c0Lkotlin/coroutines/Continuation<-Unit>;)Object | b.M |
| POST | `food_v2/edit-custom-food` | @Body m0 | (m0Lkotlin/coroutines/Continuation<-Unit>;)Object | b.l |
| POST | `food_v2/edit-custom-food` | @Body d0 | (d0Lkotlin/coroutines/Continuation<-Unit>;)Object | b.q |
| POST | `food_v2/fix-custom-food` | @Body x | (xLkotlin/coroutines/Continuation<-a>;)Object | b.S |
| POST | `foodlog/foodlog_sync/` | @Body RequestBody, @Query(source) String, @Query(token) String | (RequestBodyStringString)Lio/reactivex/s<l>; | j.h |
| GET | `foodmeasures/measures_preference` |  | ()Lio/reactivex/b0<Ljava/util/List<String>;>; | j.k |
| GET | `foods/db_download_url` |  | ()Lio/reactivex/b0<Lretrofit2/Response<j>;>; | c.a |
| GET | `foods/food_search?` | @Query(limit) I, @Query(search_term) String, @Query(meal_type) String, @Query(country_code) String | (IStringStringString)Lio/reactivex/b0<Lretrofit2/Response<Ljava/util/List<e>;>;>; | k.a |
| GET | `foods/food_search?` | @Query(limit) I, @Query(search_term) String | (IString)Lio/reactivex/s<Lretrofit2/Response<Ljava/util/List<e>;>;>; | k.c |
| GET | `foods/food_search?` | @Query(search_term) String, @Query(meal_type) String, @Query(is_diy) Z | (StringStringZ)Lio/reactivex/b0<Lretrofit2/Response<Ljava/util/List<i>;>;>; | f.a |
| GET | `foods/meal_type` | @Query(time_of_day_in_mins) I | (ILkotlin/coroutines/Continuation<-i0>;)Object | b.p |
| GET | `foods/measures/relevant` | @Query(food_id) J, @Query(food_name) String | (JString)Lio/reactivex/b0<Lretrofit2/Response<FoodDetailsResponse>;>; | j.g |
| POST | `foods/report_issue/` | @Body FoodIssuePostBody | (FoodIssuePostBody)Lretrofit2/Call<Void>; | j.f |
| GET | `foods/social_data` |  | ()Lio/reactivex/b0<g>; | g.e |
| GET | `free_trial_quiz/` |  | ()Lio/reactivex/b0<Ljava/util/List<q>;>; | c.e |
| POST | `freemium/activate` |  | (Lkotlin/coroutines/Continuation<-l>;)Object | a.a |
| POST | `freemium/extend/` |  | (Lkotlin/coroutines/Continuation<-b>;)Object | a.a |
| GET | `freemium/stats/` | @Query(feature_type) String | (StringLkotlin/coroutines/Continuation<-c>;)Object | a.b |
| DELETE | `garmin/disconnect/` |  | ()Lretrofit2/Call<Void>; | a0.z |
| POST | `gcm/register/` | @Body j | (j)Lretrofit2/Call<Void>; | a0.h |
| POST | `gcm/test` |  | ()Lretrofit2/Call<j>; | o.a |
| GET | `geo_location/search/` | @Query(query) String | (String)Lio/reactivex/b0<PlaceSearchResults>; | GeoLocationApiService.a |
| GET | `global-feeds/sources/list/` |  | ()Lio/reactivex/b0<Lretrofit2/Response<FeedSourceListResponse>;>; | b.f |
| POST | `glp-hub/weight/` | @Body l | (lLkotlin/coroutines/Continuation<-n1>;)Object | a.i |
| GET | `goal_settings/calorie_budget_info` |  | ()Lio/reactivex/b0<k>; | c.b |
| POST | `goal_settings/edit` | @Body l | a | c.a |
| GET | `group/sync/` | @Query(sync_token) J | (J)Lio/reactivex/s<GroupV2ApiResponse>; | m.c |
| PUT | `group_members/{group-id}/user/exit/` | @Path(group-id) String | (String)Lretrofit2/Call<Void>; | m.j |
| PUT | `group_members/{group-id}/user/join/` | @Path(group-id) String | (String)Lretrofit2/Call<Void>; | m.b |
| POST | `groupchat/img/upload/` | @Part MultipartBody$Part | (MultipartBody$Part)Lretrofit2/Call<l>; | m.g |
| POST | `groupchat/report/chat/` | @Body ReportChatData | a | m.h |
| PUT | `groupchat/{group_id}/add_user_to_group/` | @Path(group_id) String, @Body AddMemberData | (StringAddMemberData)Lretrofit2/Call<Void>; | m.a |
| GET | `groupchat/{group_id}/banner` | @Path(group_id) String | (String)Lio/reactivex/b0<Lretrofit2/Response<a>;>; | d.a |
| POST | `growth/trigger-cta/fetch` | @Body Map | (Ljava/util/Map<StringInteger>;Lkotlin/coroutines/Continuation<-a>;)Object | a.a |
| GET | `healthify-tags/sync` |  | (Lkotlin/coroutines/Continuation<-Lretrofit2/Response<e>;>;)Object | a.a |
| POST | `healthify-tags/sync` | @Body e | (eLkotlin/coroutines/Continuation<-Unit>;)Object | a.b |
| GET | `healthify-tags/tag-data` | @Query(tag_id) String, @Query(tag_type) I | (StringILkotlin/coroutines/Continuation<-Lretrofit2/Response<c>;>;)Object | a.d |
| GET | `healthify-tags/ui-configs` | @Query(tag_types) List | (Ljava/util/List<Integer>;Lkotlin/coroutines/Continuation<-b>;)Object | a.c |
| GET | `healthifyme-prod/api/v1/ft_config.json` |  | ()Lretrofit2/Call<j>; | b0.a |
| GET | `https://healthifyme-public.s3.ap-southeast-1.amazonaws.com/static/planned_downtime.json` |  | (Lkotlin/coroutines/Continuation<-OngoingMaintenanceInfo>;)Object | a.a |
| GET | `ibgs/eligible` |  | ()Lio/reactivex/s<EligibleGroupsApiResponse>; | m.d |
| PUT | `ibgs/{group-id}/join/` | @Path(group-id) String | a | m.f |
| POST | `infra/config/app_configs/` | @Body h | (h)Lio/reactivex/b0<Ljava/util/HashMap<Stringp>;>; | g.d |
| POST | `infra/config/app_configs/` | @Body h | (h)Lio/reactivex/b0<a>; | g.e |
| POST | `infra/config/app_configs/` | @Body e | (eLkotlin/coroutines/Continuation<-Lretrofit2/Response<j>;>;)Object | d.c |
| POST | `infra/config/app_configs/` | @Body f | (f)Lio/reactivex/b0<Ljava/util/Map<StringLjava/util/Map<Stringg>;>;>; | c.a |
| POST | `infra/config/app_configs/` | @Body f | (f)Lio/reactivex/b0<i>; | d.a |
| POST | `infra/config/app_configs/` | @Body e | otlin/coroutines/Continuation<-Lretrofit2/Response<Ljava/util/HashMap<Stringa>;>;>;)Object | a.c |
| POST | `infra/config/app_configs/` | @Body z$a | (z$a)Lio/reactivex/b0<z$b>; | z.e |
| GET | `infra/config/growth_hook/?action=food_tracked` |  | (Lkotlin/coroutines/Continuation<-f>;)Object | a.a |
| GET | `infra/config/growth_hook/?action=weight_tracked` |  | ()Lio/reactivex/b0<h>; | b.m |
| POST | `infra/config/settings/` | @Body ConfigKeys | (ConfigKeys)Lio/reactivex/b0<ConfigSettingsData>; | z.c |
| GET | `insight/templates` |  | ()Lio/reactivex/b0<Lretrofit2/Response<e>;>; | d.a |
| POST | `insights/feedback` | @Body j | a | c.b |
| GET | `insights/insights_page` | @Query(meal_type) String, @Query(date) String, @Query(force_refresh) Z | (StringStringZ)Lio/reactivex/b0<s>; | c.a |
| GET | `intermittent_fasting/home` | @Query(is_fasting) Z | (ZLkotlin/coroutines/Continuation<-n>;)Object | h.b |
| GET | `intermittent_fasting/plans` |  | (Lkotlin/coroutines/Continuation<-IFPlansModel>;)Object | a.b |
| GET | `intermittent_fasting/settings` |  | (Lkotlin/coroutines/Continuation<-Lretrofit2/Response<e>;>;)Object | a.e |
| GET | `intermittent_fasting/trend` | @Query(start_date) String, @Query(end_date) String | (StringStringLkotlin/coroutines/Continuation<-n>;)Object | h.a |
| PUT | `intermittent_fasting/user_plan` | @Body c | (cLkotlin/coroutines/Continuation<-IFSuccessModel>;)Object | a.a |
| PATCH | `intermittent_fasting/user_plan` | @Body c | (cLkotlin/coroutines/Continuation<-IFSuccessModel>;)Object | a.d |
| POST | `/iot/api/v1/cgm/libre-1/calibrate` | @Body c0 | (c0)Lio/reactivex/b0<e>; | c.e |
| POST | `journey/goal/click` | @Body b | a | a.a |
| POST | `journey/goal/click` | @Body b | a | b$a.f |
| POST | `journey/goal/expire` | @Body a | a | b$a.b |
| POST | `journey/goal/failure/feedback` | @Body d | a | a.b |
| POST | `journey/goal/failure/feedback` | @Body d | a | b$a.a |
| GET | `journey/goal/failure/options` |  | ()Lio/reactivex/b0<c>; | a.c |
| GET | `journey/goal/failure/options` |  | ()Lio/reactivex/b0<Lretrofit2/Response<c>;>; | b$a.e |
| POST | `journey/goal/rejection/feedback` | @Body f | a | b$a.c |
| GET | `journey/goal/rejection/options` |  | ()Lio/reactivex/b0<Lretrofit2/Response<e>;>; | b$a.d |
| POST | `journey/start` |  | ()Lio/reactivex/b0<Lretrofit2/Response<Object>;>; | b$a.h |
| GET | `journey/user/goals` |  | ()Lio/reactivex/b0<Lretrofit2/Response<b>;>; | b$a.g |
| POST | `json_store/app_settings` | @Body SettingsData | (SettingsData)Lio/reactivex/b0<Lretrofit2/Response<j>;>; | z.d |
| GET | `json_store/app_settings` |  | ()Lio/reactivex/b0<Lretrofit2/Response<SettingsData>;>; | z.getAppSettings |
| POST | `json_store/generic` | @Body h | (h)Lio/reactivex/b0<Lretrofit2/Response<j>;>; | g.d |
| POST | `json_store/generic` | @Body a$c | (a$cLkotlin/coroutines/Continuation<-Lretrofit2/Response<j>;>;)Object | a.b |
| GET | `juspay/initiate` |  | ()Lio/reactivex/b0<JuspayPayload>; | d.d |
| POST | `language/translate/v2?key=invalid-key` | @Body b | (b)Lio/reactivex/b0<c>; | d$a.h |
| GET | `lbd/snapshot/latest/` | @Query(challenge_id) J, @Query(activity_type) String | (JString)Lretrofit2/Call<LeaderboardWinner>; | p.b |
| GET | `leaderboard/challenges/` |  | ()Lio/reactivex/b0<ChallengesResponse>; | p.a |
| GET | `leaderboard/ranks/` |  | ()Lio/reactivex/b0<Lretrofit2/Response<ChallengeRanksResponseV2>;>; | u.b |
| POST | `log_predictor/next_foods` | @Body NextFoodApiPostBody | (NextFoodApiPostBody)Lretrofit2/Call<NewNextFoodApiResponse>; | j.e |
| GET | `low_cost/plans` | @Query(ucb_enabled) Z | (Z)Lio/reactivex/b0<LowCostPlansResponse>; | a.a |
| GET | `meal-preferences/budgets` |  | ()Lio/reactivex/b0<CalorieBudgetEditorResponse>; | CalorieBudgetEditorApiService.fetchCalorieBudgets |
| POST | `meal-preferences/budgets` | @Body PostCalorieBudgetItems | a | CalorieBudgetEditorApiService.postSavedCalBudgetChanges |
| GET | `meal-preferences/meals` |  | ()Lio/reactivex/b0<MealEditorResponse>; | MealEditorApiService.fetchMealsAndTimings |
| POST | `meal-preferences/meals` | @Body UserSelectedMealsPostBody | (UserSelectedMealsPostBody)Lio/reactivex/b0<UpdatedCalDistributionResponse>; | MealEditorApiService.postSavedMealChanges |
| POST | `meal-preferences/meals` | @Query(reset) Z, @Body l | a | MealEditorApiService.postSavedMealChangesWithEmptyBody |
| POST | `medical/challenge/join/` | @Body a | (a)Lio/reactivex/s<Lretrofit2/Response<j>;>; | a.b |
| GET | `medical/options/` |  | ()Lio/reactivex/s<Lretrofit2/Response<b>;>; | a.a |
| POST | `medicine/migration/` |  | (Lkotlin/coroutines/Continuation<-k>;)Object | m.g |
| GET | `medicine/user/dose-logs/list/` | @Query(medicine_id) J, @Query(sync_token) String, @Query(limit) Integer | (JStringIntegerLkotlin/coroutines/Continuation<-g>;)Object | m.d |
| PUT | `medicine/user/dose-logs/status/` | @Body o | (oLkotlin/coroutines/Continuation<Object>;)Object | m.e |
| GET | `medicine/user/medicine-units/` |  | (Lkotlin/coroutines/Continuation<-i>;)Object | m.a |
| POST | `medicine/user/medicines/` | @Body a | (aLkotlin/coroutines/Continuation<-b>;)Object | m.h |
| DELETE | `medicine/user/medicines/delete/` | @Query(medicine_id) J | (JLkotlin/coroutines/Continuation<Object>;)Object | m.c |
| GET | `medicine/user/medicines/detail/` | @Query(medicine_id) J | (JLkotlin/coroutines/Continuation<-h>;)Object | m.k |
| GET | `medicine/user/medicines/list/` | @Query(sync_token) String | (StringLkotlin/coroutines/Continuation<-j>;)Object | m.j |
| PUT | `medicine/user/medicines/update-reminder/` | @Body q | (qLkotlin/coroutines/Continuation<-r>;)Object | m.i |
| POST | `medicine/user/medicines/update/` | @Body s | (sLkotlin/coroutines/Continuation<-t>;)Object | m.f |
| POST | `message/send` | @PartMap Map | (Ljava/util/Map<StringRequestBody>;)Lio/reactivex/b0<Lretrofit2/Response<l>;>; | i.a |
| POST | `message/send` | @Part MultipartBody$Part, @PartMap Map | partBody$PartLjava/util/Map<StringRequestBody>;)Lio/reactivex/b0<Lretrofit2/Response<l>;>; | i.b |
| GET | `messages/latest` | @Query(sync_token) I | (I)Lio/reactivex/b0<Lretrofit2/Response<b>;>; | i.d |
| POST | `multimedia/imagekit/auth_params` | @Body Map | (Ljava/util/Map<StringObject>;)Lretrofit2/Call<ImageKitAuthResponse>; | m.e |
| POST | `my-meals/` | @Body Meal | a | b.a |
| GET | `my-meals/` | @Query(sync_token) String, @Query(limit) I | (StringI)Lio/reactivex/b0<MyMeals>; | b.c |
| DELETE | `my-meals/{id}` | @Path(id) J | a | b.b |
| PUT | `my-meals/{id}` | @Path(id) J, @Body Meal | a | b.d |
| GET | `next_gen/active_choice/data` | @Query(active_choice_id) I | (ILkotlin/coroutines/Continuation<-e>;)Object | a.b |
| GET | `next_gen/active_choice/info` |  | (Lkotlin/coroutines/Continuation<-d>;)Object | a.a |
| GET | `next_gen/dashboard/detail` | @Query(ob_data_required) String | (StringLkotlin/coroutines/Continuation<-m0>;)Object | a.c |
| GET | `next_gen/navigation-config` |  | (Lkotlin/coroutines/Continuation<-a>;)Object | a.a |
| POST | `next_gen/ob/me-data-sharing-consent` | @Body e | (eLkotlin/coroutines/Continuation<-Lretrofit2/Response<Unit>;>;)Object | z.h |
| GET | `next_gen/ob/me-welcome-screen-config` |  | (Lkotlin/coroutines/Continuation<-c0>;)Object | z.f |
| GET | `next_gen/onboarding/info` |  | (Lkotlin/coroutines/Continuation<-d>;)Object | c.a |
| GET | `next_gen/onboarding/welcome-screen-config` |  | ()Lio/reactivex/b0<i>; | z.g |
| GET | `next_gen/timeline/info` | @Query(user_date) String, @Query(is_fcm_refresh) Z | (StringZLkotlin/coroutines/Continuation<-Ljava/util/List<f>;>;)Object | a.e |
| GET | `next_gen/timeline/insight` | @Query(timeline_id) String | (StringLkotlin/coroutines/Continuation<-f$d$b>;)Object | a.h |
| GET | `next_gen/timeline/progress` |  | (Lkotlin/coroutines/Continuation<-e>;)Object | a.d |
| POST | `nps/` | @Body s | (s)Lio/reactivex/b0<Lretrofit2/Response<Object>;>; | o.c |
| POST | `nps/activity/update` | @Body l | a | o.b |
| GET | `nps/config` |  | ()Lio/reactivex/b0<p>; | o.d |
| GET | `nps/thank_you_screen` |  | ()Lio/reactivex/b0<i>; | o.a |
| POST | `objectives/sync/` | @Query(format) String, @Body ObjectivesSyncData | (StringObjectivesSyncData)Lio/reactivex/s<ObjectivesSyncResponse>; | s.a |
| POST | `omron/data/fetch/trigger` | @Body OmronSyncPostBody | a | a0.C |
| GET | `onboardings/` | @Query(onboarding_type) I | (ILkotlin/coroutines/Continuation<-l0>;)Object | b.s |
| POST | `onboardings/` | @Body k0 | (k0Lkotlin/coroutines/Continuation<-Unit>;)Object | b.x |
| GET | `onboardings/configs/?onboarding_keys=auto_snap_post_enable_v2` |  | (Lkotlin/coroutines/Continuation<-a>;)Object | b.m |
| GET | `onboardings/configs/?onboarding_keys=auto_snap_v2` |  | (Lkotlin/coroutines/Continuation<-a>;)Object | b.G |
| GET | `onboardings/configs/?onboarding_keys=manual_snap_v2` |  | (Lkotlin/coroutines/Continuation<-e0>;)Object | b.g |
| POST | `opt-out/account/delete` |  | a | c.b |
| POST | `opt-out/data/export` | @Body b | a | c.a |
| POST | `otp/anonymous/verify` | @Body b | (b)Lio/reactivex/b0<Lretrofit2/Response<e>;>; | h.b |
| POST | `otp/send` | @Body c | (c)Lio/reactivex/b0<Lretrofit2/Response<j>;>; | g$a.d |
| POST | `otp/send` | @Body a | (a)Lio/reactivex/b0<Lretrofit2/Response<j>;>; | h.a |
| GET | `otp/sms/send` | @Query(phone_number) String, @Query(for_logged_in_user) I, @Query(feature_name) String | (StringIString)Lio/reactivex/b0<Lretrofit2/Response<j>;>; | h.c |
| POST | `payment/app/link/generate` | @Body Map | /Map<StringObject>;)Lio/reactivex/b0<Lretrofit2/Response<PaymentGenerateParamsResponse>;>; | a0.b |
| POST | `payment/app/link/generate` | @Body Map | /Map<StringString>;)Lio/reactivex/b0<Lretrofit2/Response<PaymentGenerateParamsResponse>;>; | d.b |
| GET | `payment/applicable/discounts` | @Query(plan_id) I | (ILkotlin/coroutines/Continuation<-Ljava/util/List<Discount>;>;)Object | c.a |
| POST | `payment/charge` | @Body u | (u)Lio/reactivex/s<Lretrofit2/Response<j>;>; | q.l |
| POST | `payment/charge` | @Body StripePaymentPostBody | (StripePaymentPostBody)Lio/reactivex/s<Lretrofit2/Response<a>;>; | d.a |
| POST | `payment/charge` | @Body c | (c)Lio/reactivex/s<Lretrofit2/Response<a>;>; | d.e |
| POST | `payment/charge` | @Body JuspayPostParam | (JuspayPostParam)Lio/reactivex/b0<JuspayPaymentStatusResponse>; | d.c |
| GET | `payment/checkout/params` | @Query(plan_id) I | (I)Lio/reactivex/s<Lretrofit2/Response<a>;>; | d.b |
| GET | `payment/microplans/` |  | ()Lio/reactivex/b0<Lretrofit2/Response<MicroPlansResponse>;>; | g.f |
| POST | `payment/params/pre-payment/generate` | @Body b | (b)Lio/reactivex/s<Lretrofit2/Response<GatewayParams>;>; | d.f |
| POST | `payment/params/pre-payment/generate` | @Body JuspaySPPostBody | (JuspaySPPostBody)Lio/reactivex/b0<JuspaySPResponse>; | d.e |
| POST | `payment/params/pre-subscription-payment/generate/` | @Body b | (b)Lio/reactivex/b0<Lretrofit2/Response<h>;>; | d.c |
| POST | `payment/plan/request/` | @Body RequestPlanActivationData | tPlanActivationData)Lio/reactivex/b0<Lretrofit2/Response<RequestPlanActivationResponse>;>; | g.b |
| GET | `payment/plan/{plan_id}` | @Path(plan_id) I | (I)Lio/reactivex/s<Lretrofit2/Response<PlansV3EachPlan>;>; | d.d |
| POST | `payment/plan/{plan_id}/notify/open` | @Path(plan_id) I, @Body l | (Il)Lio/reactivex/b0<Lretrofit2/Response<j>;>; | d.g |
| GET | `payment/plans/recommended` |  | ()Lio/reactivex/b0<o>; | h.c |
| GET | `payment/validate/discount_coupon/` | @Query(coupon_code) String, @Query(plan_id) I, @Query(months) I | (StringII)Lretrofit2/Call<RedeemAPIResponse>; | a0.E |
| GET | `payment_membership/manage` |  | ()Lio/reactivex/b0<a>; | a.b |
| POST | `payment_membership/pause/` | @Body a | (a)Lio/reactivex/b0<Lretrofit2/Response<j>;>; | g.g |
| GET | `payment_membership/pause/flow` |  | ()Lio/reactivex/b0<PauseSubscriptionFlowData>; | a.a |
| GET | `payment_membership/plan_pause_details` |  | ()Lio/reactivex/b0<Lretrofit2/Response<b>;>; | g.d |
| POST | `payment_membership/resume/` | @Body j | (j)Lio/reactivex/b0<Lretrofit2/Response<j>;>; | g.e |
| GET | `plan/yoga/day/{index}` | @Path(index) I | (I)Lio/reactivex/b0<c>; | a.b |
| GET | `plan/yoga/summary` |  | ()Lio/reactivex/b0<a>; | a.a |
| GET | `plans/all` | @Query(plan_id) Integer | (Integer)Lio/reactivex/b0<Lretrofit2/Response<AllPlansResponse>;>; | g.a |
| GET | `points/level/` |  | ()Lio/reactivex/b0<Lretrofit2/Response<LevelsResponse>;>; | u.a |
| POST | `pre-signup-profile/me` | @Body j | (j)Lretrofit2/Call<j>; | a0.j |
| GET | `pro/ob/config` |  | ()Lio/reactivex/b0<ProPlanUiInfo>; | c.b |
| POST | `pro/ob/done` |  | a | c.a |
| POST | `profile` | @Header(Authorization) String, @Body TrueProfile | (StringTrueProfile)Lretrofit2/Call<JSONObject>; | a.a |
| GET | `profile` | @Header(Authorization) String | (String)Lretrofit2/Call<TrueProfile>; | a.b |
| PUT | `profile/me` | @Body j | (j)Lretrofit2/Call<j>; | a0.H |
| POST | `profile/me/picture/set/` | @Part MultipartBody$Part | (MultipartBody$Part)Lretrofit2/Call<Void>; | a0.p |
| GET | `profile/me?view=plan` |  | ()Lio/reactivex/b0<o2$a>; | a0.u |
| POST | `profile_extras/me` | @Body j | (j)Lio/reactivex/b0<j>; | a0.K |
| GET | `profile_extras/me` |  | ()Lio/reactivex/b0<j>; | a0.Z |
| POST | `profile_extras/me/pedometer/connect/` | @Body ConnectedDevicePostData | (ConnectedDevicePostData)Lretrofit2/Call<Void>; | a0.t |
| POST | `profile_extras/me/pedometer/disconnect` |  | ()Lio/reactivex/b0<Lretrofit2/Response<j>;>; | a0.k |
| GET | `profile_public/{user_id}` | @Path(user_id) String | (String)Lio/reactivex/s<MeTabProfile>; | q.getProfile |
| GET | `question/flow/initial_question` | @Query(question_type) I | (I)Lio/reactivex/b0<FlowQuestion>; | a.a |
| GET | `question/flow/initial_question` | @Query(question_type) I | (ILkotlin/coroutines/Continuation<-Lretrofit2/Response<FlowQuestion>;>;)Object | a.a |
| GET | `question/flow/initial_question` | @Query(question_type) I | (I)Lio/reactivex/b0<PlanRecoQuestion>; | h.a |
| GET | `question/flow/initial_question` | @Query(question_type) I | (ILkotlin/coroutines/Continuation<-Lretrofit2/Response<RatingRemoteResponse>;>;)Object | a.a |
| POST | `question/flow/submit_next` | @Body FlowQuestion | (FlowQuestion)Lio/reactivex/b0<FlowQuestion>; | a.b |
| POST | `question/flow/submit_next` | @Body PlanRecoQuestion | (PlanRecoQuestion)Lio/reactivex/b0<PlanRecoQuestion>; | h.d |
| POST | `question/flow/submit_next` | @Body j | (jLkotlin/coroutines/Continuation<-RatingRemoteResponse>;)Object | a.b |
| GET | `question/flow/user_report` |  | ()Lio/reactivex/b0<p>; | h.e |
| GET | `quizzer/` | @Query(question_type) I | (I)Lio/reactivex/b0<Ljava/util/List<q>;>; | s.c |
| GET | `quizzer/` | @Query(question_type) I | (I)Lio/reactivex/b0<Ljava/util/List<Question>;>; | b.c |
| GET | `quizzer/` | @Query(question_type) I | (I)Lio/reactivex/b0<Lretrofit2/Response<Ljava/util/List<Question>;>;>; | b.f |
| GET | `quizzer/` | @Query(question_type) I | (ILkotlin/coroutines/Continuation<-Ljava/util/List<QuizzerQuestion>;>;)Object | c.a |
| POST | `quizzer/answer` | @Body m | a | c.b |
| POST | `quizzer/answer` | @Body g | a | b.h |
| POST | `quizzer/answer` | @Body a | (aLkotlin/coroutines/Continuation<Object>;)Object | c.b |
| POST | `quizzer/answer/bulk` | @Body List | (Ljava/util/List<g>;)a | b.e |
| GET | `quizzer/answer/details` | @Query(question_type) I | (I)Lio/reactivex/b0<Ljava/util/List<a>;>; | s.a |
| GET | `quizzer/answer/details` | @Query(question_type) I | (I)Lio/reactivex/b0<Ljava/util/List<a>;>; | b.a |
| GET | `quizzer/answer/summary` | @Query(question_type) I | (I)Lio/reactivex/b0<h>; | s.d |
| GET | `quizzer/hash` |  | ()Lio/reactivex/b0<Lretrofit2/Response<d>;>; | b.b |
| GET | `quizzer/hash` |  | ()Lio/reactivex/b0<h>; | h.b |
| POST | `quizzer/user/{user_id}/answer/save` | @Path(user_id) I, @Body f | a | b.d |
| GET | `quizzer/verbose/` | @Query(question_type) I | (I)Lio/reactivex/b0<Lretrofit2/Response<i>;>; | b.g |
| POST | `rating/` | @Body f | (f)Lretrofit2/Call<Void>; | d.e |
| POST | `rating/` | @Body b | a | a.e |
| POST | `rating/event/` | @Body h | a | d.a |
| POST | `rating/event/no_call/` | @Body e | a | d.d |
| GET | `rating/info/` | @Query(type) String | (String)Lio/reactivex/b0<b>; | a0.d |
| GET | `rating/info/` | @QueryMap Map | (Ljava/util/Map<StringString>;)Lio/reactivex/b0<b>; | d.b |
| GET | `rating/info/` | @Query(type) String | (String)Lio/reactivex/b0<b>; | a.d |
| POST | `rating/plan/` | @Body PlanFeedbackPostBody | (PlanFeedbackPostBody)Lio/reactivex/b0<Lretrofit2/Response<Void>;>; | a0.W |
| GET | `rating/playstore/list` | @Query(is_nudging) Z, @Query(user_categories) List | (ZLjava/util/List<Integer>;)Lio/reactivex/b0<a>; | a.a |
| POST | `rating/rate/expert/` | @Body g | a | d.c |
| POST | `rating/rate/expert_message/` | @Body MessageRatingPostBody | (MessageRatingPostBody)Lio/reactivex/b0<Lretrofit2/Response<l>;>; | i.c |
| POST | `referral/` | @Body d | (d)Lio/reactivex/s<Lretrofit2/Response<b>;>; | d.b |
| GET | `referral/history` | @Query(offset) I, @Query(only_history_info) Z | (IZ)Lio/reactivex/b0<f>; | a.a |
| POST | `referral/redeem/` | @Body a | (a)Lretrofit2/Call<Void>; | d.a |
| GET | `referral/status/` |  | ()Lretrofit2/Call<CorporateReferralData>; | d.c |
| GET | `referral/validate/{referral_code}/` | @Path(referral_code) String | a | g$a.j |
| GET | `reminders/all` | @Query(sync_token) String | (String)Lio/reactivex/b0<Lretrofit2/Response<ReminderAPIResponse>;>; | a.a |
| GET | `reports/week-theme-data/` | @Query(week_start_date) String | (String)Lio/reactivex/b0<Lretrofit2/Response<h>;>; | b.a |
| GET | `reports/weekly-report/data/` | @Query(activity_type) String, @Query(week_start_date) String | (StringString)Lio/reactivex/b0<Lretrofit2/Response<a>;>; | b.c |
| GET | `reports/weekly-report/overview/` | @Query(week_start_date) String | (String)Lio/reactivex/b0<Lretrofit2/Response<e>;>; | b.b |
| POST | `ria/app/response` | @Body AssistantQuestionPostData | (AssistantQuestionPostData)Lio/reactivex/b0<Lretrofit2/Response<AssistantApiResponse>;>; | d$a.l |
| GET | `ria/app/response/info` | @Query(question_id) I, @Query(sync_token) String | (IString)Lio/reactivex/b0<Lretrofit2/Response<AssistantApiResponse>;>; | d$a.n |
| POST | `ria/app/response/stream` | @Body AssistantQuestionPostData | (AssistantQuestionPostData)Lio/reactivex/b0<Lretrofit2/Response<AssistantApiResponse>;>; | d$a.e |
| GET | `ria/capabilities` |  | ()Lio/reactivex/b0<[RiaPrompt>; | d$a.j |
| POST | `ria/conversation/initiate` | @Body AssistantInitiateConversationPostData | ta)Lio/reactivex/b0<Lretrofit2/Response<AssistantInitiateResumeConversationApiResponse>;>; | d$a.b |
| POST | `ria/conversation/resume` | @Body AssistantInitiateResumeConversationPostData | ta)Lio/reactivex/b0<Lretrofit2/Response<AssistantInitiateResumeConversationApiResponse>;>; | d$a.i |
| POST | `ria/conversations` | @Body RiaConversationsPostData | (RiaConversationsPostData)Lio/reactivex/b0<RiaConversationApiResponse>; | d$a.d |
| POST | `ria/feedback` | @Body h | (h)Lio/reactivex/b0<Unit>; | d$a.k |
| POST | `ria/initialize` | @Body AssistantInitializePostData | (AssistantInitializePostData)Lio/reactivex/b0<Lretrofit2/Response<f>;>; | d$a.f |
| GET | `ria/journey/config` | @Query(tab) String | (String)Lio/reactivex/b0<AssistantCardDataResponse>; | y.b |
| POST | `ria/message/feedback` | @Body e | (e)Lio/reactivex/b0<Lretrofit2/Response<MessageFeedbackApiResponse>;>; | d$a.g |
| POST | `ria/message/seen` | @Body RiaMessageSeenPostData | (RiaMessageSeenPostData)Lio/reactivex/b0<Lretrofit2/Response<j>;>; | d$a.p |
| GET | `ria_ctas/config` | @Query(cta_category) String, @Query(limit) I | (StringI)Lio/reactivex/b0<Lretrofit2/Response<Ljava/util/List<g0>;>;>; | d$a.m |
| GET | `ria_ctas/workout-set/config` | @Query(workout_set_id) I | (I)Lio/reactivex/b0<Lretrofit2/Response<g0>;>; | d$a.c |
| GET | `roshbot/trigger_to_cta_map` |  | ()Lio/reactivex/b0<Lretrofit2/Response<d>;>; | c.a |
| POST | `sales/call-options/exit/user` | @Body ColdSalesLead | (ColdSalesLead)Lio/reactivex/b0<Lretrofit2/Response<j>;>; | CallOptionsApi$CallOptionsApiService.sendColdLeadToSales |
| GET | `sales/call-options/slots/` | @Query(timezone) String, @Query(ignore_eligibility) Z | (StringZ)Lio/reactivex/b0<Lretrofit2/Response<CallOptions>;>; | CallOptionsApi$CallOptionsApiService.getCallOptionsData |
| POST | `sales/call-options/slots/book/` | @Body CallOptions$CallSlotPostFormat | (CallOptions$CallSlotPostFormat)Lio/reactivex/b0<Lretrofit2/Response<j>;>; | CallOptionsApi$CallOptionsApiService.saveSelectedCallSlot |
| GET | `shipment/pro-product/{id}` | @Path(id) I, @Query(order_id) Integer | (IInteger)Lio/reactivex/b0<b>; | a.g |
| PUT | `sleep_goal/` | @Body f | a | a.b |
| GET | `sleep_goal/` |  | ()Lio/reactivex/b0<f>; | a.e |
| POST | `sleep_log/sync` | @Query(sync_mode) String, @Body h | (Stringh)Lio/reactivex/b0<h>; | a.c |
| GET | `smart-plan/food/category/next` | @Query(page) Integer | (Integer)Lio/reactivex/b0<Lretrofit2/Response<u>;>; | d.j |
| GET | `smart-plan/subscription/app` |  | ()Lio/reactivex/b0<Lretrofit2/Response<d0>;>; | q.d |
| POST | `snap/auto_track_state` | @Body p0 | (p0Lkotlin/coroutines/Continuation<-Unit>;)Object | b.A |
| GET | `snap/dashboard-card-config` | @Query(date) String | (StringLkotlin/coroutines/Continuation<-a>;)Object | a.b |
| DELETE | `snap/delete_image/{image_id}` | @Path(image_id) J | (JLkotlin/coroutines/Continuation<-Unit>;)Object | b.Q |
| GET | `snap/detect_foods` | @Query(image_id) J, @Query(x_coordinate) I, @Query(y_coordinate) I, @Query(width) I, @Query(height) I | (JIIIILkotlin/coroutines/Continuation<-k>;)Object | b.P |
| GET | `snap/foods-segmentation` | @Query(image_id) J | (JLkotlin/coroutines/Continuation<-n>;)Object | b.N |
| GET | `snap/images-lifecycle-state` | @Query(uuid) String | (StringLkotlin/coroutines/Continuation<-o>;)Object | b.F |
| GET | `snap/images-lifecycle-state?is_auto_snap=false` |  | (Lkotlin/coroutines/Continuation<-o>;)Object | b.W |
| GET | `snap/insights` | @Query(image_ids) List | (Ljava/util/List<Long>;Lkotlin/coroutines/Continuation<-b>;)Object | b.X |
| GET | `snap/insights-individual-foods` | @Query(image_id) J | (JLkotlin/coroutines/Continuation<-c>;)Object | b.J |
| GET | `snap/insights-score-nutrition` | @Query(image_id) J | (JLkotlin/coroutines/Continuation<-c>;)Object | b.I |
| GET | `snap/insights-summary` | @Query(image_id) J | (JLkotlin/coroutines/Continuation<-c>;)Object | b.B |
| POST | `snap/mark_image_as_reviewed` | @Body t | (tLkotlin/coroutines/Continuation<-Unit>;)Object | b.U |
| GET | `snap/model` |  | (Lkotlin/coroutines/Continuation<-j0>;)Object | b.R |
| GET | `snap/queue-state` |  | (Lkotlin/coroutines/Continuation<-ImagesPendingInQueueResponse>;)Object | b.k |
| POST | `snap/report_fnf_result` | @Body RequestBody | (RequestBodyLkotlin/coroutines/Continuation<-Unit>;)Object | b.b |
| POST | `snap/upload` | @Body RequestBody | (RequestBodyLkotlin/coroutines/Continuation<-f0>;)Object | b.L |
| POST | `snap/upload` | @Body RequestBody,  h2 | (RequestBodyh2Lkotlin/coroutines/Continuation<-f0>;)Object | b.n |
| GET | `snap_feed/` | @Query(sync_token) I | (ILkotlin/coroutines/Continuation<-c>;)Object | h.b |
| GET | `snap_feed/` | @Query(sync_token) I, @Query(filters) List | (ILjava/util/List<String>;Lkotlin/coroutines/Continuation<-c>;)Object | h.d |
| GET | `snap_feed/details` | @Query(image_id) I | (ILkotlin/coroutines/Continuation<-f>;)Object | h.a |
| GET | `snap_feed/filters` |  | (Lkotlin/coroutines/Continuation<-a>;)Object | h.f |
| POST | `snap_feed/generate-recipe/` | @Body b | (bLkotlin/coroutines/Continuation<-g>;)Object | h.c |
| GET | `snap_feed/recipe-status/` | @Query(image_id) I | (ILkotlin/coroutines/Continuation<-g>;)Object | h.e |
| POST | `sp/ob/done` |  | ()Lio/reactivex/b0<j>; | q.j |
| GET | `sp/ob/explain` |  | ()Lio/reactivex/b0<e>; | q.n |
| GET | `sp/ob/flow` |  | ()Lio/reactivex/b0<Lretrofit2/Response<f>;>; | d.h |
| GET | `staff/shift` |  | ()Lio/reactivex/b0<Lretrofit2/Response<e>;>; | d.j |
| GET | `streak/milestone/` |  | ()Lio/reactivex/b0<Lretrofit2/Response<MilestoneResponse>;>; | t$a.getStreaks |
| GET | `streaks/` |  | ()Lretrofit2/Call<l>; | StreaksAPI.getStreaks |
| GET | `stream_chat/get-token` |  | ()Lio/reactivex/b0<i>; | c.a |
| GET | `studio/session/filter` | @Query(start_date) String, @Query(limit) I | (StringI)Lio/reactivex/b0<Ljava/util/List<f>;>; | c.a |
| POST | `suggest_missing_food/` | @Body FoodSuggestData | (FoodSuggestData)Lio/reactivex/b0<Lretrofit2/Response<Void>;>; | j.c |
| GET | `suggest_missing_food/closest_foods/` | @Query(food_name) String | (String)Lio/reactivex/b0<Lretrofit2/Response<FoodMatchApiResponse>;>; | j.b |
| POST | `support/issue` | @Part List, @PartMap Map | rt>;Ljava/util/Map<StringRequestBody>;)Lio/reactivex/s<Lretrofit2/Response<RaisedIssue>;>; | e.b |
| GET | `support/issue/sync` | @Query(sync_token) I | (I)Lio/reactivex/b0<Lretrofit2/Response<UserIssuesResponse>;>; | c.c |
| POST | `support/issue/{issue_id}` | @Path(issue_id) I, @Part List, @PartMap Map | artBody$Part>;Ljava/util/Map<StringRequestBody>;)Lio/reactivex/s<Lretrofit2/Response<a>;>; | e.a |
| POST | `support/issue/{issue_id}/rate` | @Path(issue_id) I, @Body b | (Ib)Lio/reactivex/b0<Lretrofit2/Response<Object>;>; | c.d |
| GET | `support/issue/{issue_id}/sync` | @Path(issue_id) I, @Query(sync_token) I | (II)Lio/reactivex/b0<Lretrofit2/Response<b>;>; | c.a |
| POST | `survey/user-device-request/` | @Body Map | (Ljava/util/Map<StringString>;)Lio/reactivex/b0<Lretrofit2/Response<Void>;>; | a0.O |
| POST | `teams/` | @Query(format) String, @Body TeamCreationPostData | (StringTeamCreationPostData)Lretrofit2/Call<TeamResponseData>; | r.d |
| GET | `teams/config` |  | ()Lio/reactivex/b0<Lretrofit2/Response<a>;>; | r.f |
| DELETE | `teams/delete/` | @Query(team_id) String, @Query(format) String | (StringString)Lretrofit2/Call<Void>; | r.h |
| GET | `teams/incomplete_teams/list` | @Query(format) String, @Query(challenge_id) I | (StringI)Lretrofit2/Call<AvailableTeamResponseData>; | r.k |
| POST | `teams/invite_action/` | @Query(format) String, @Body TeamInvitaionResponsePostData | (StringTeamInvitaionResponsePostData)Lretrofit2/Call<TeamInvitationResponseData>; | r.i |
| POST | `teams/members/invite/` | @Query(format) String, @Body TeamInvitePostData | (StringTeamInvitePostData)Lretrofit2/Call<Void>; | r.b |
| POST | `teams/members/remove_member/` | @Query(format) String, @Body TeamInvitePostData | (StringTeamInvitePostData)Lretrofit2/Call<Void>; | r.g |
| POST | `teams/members/request_action/` | @Query(format) String, @Body ResponseRequestInvitePostData | (StringResponseRequestInvitePostData)Lretrofit2/Call<Void>; | r.a |
| POST | `teams/request_to_join/` | @Query(format) String, @Body TeamId | (StringTeamId)Lretrofit2/Call<Void>; | r.j |
| GET | `teams/search_by_email/` | @Query(format) String, @Query(email) String | (StringString)Lretrofit2/Call<MyTeamResponseData>; | r.c |
| GET | `teams/{id}/` | @Path(id) String, @Query(format) String | (StringString)Lretrofit2/Call<MyTeamResponseData>; | r.e |
| POST | `terms/accept` |  | a | a.b |
| GET | `testimonial/` |  | ()Lio/reactivex/b0<TestimonialApiResponse>; | c.d |
| GET | `tracker-settings/` | @Query(type) String | (StringLkotlin/coroutines/Continuation<-a>;)Object | a.a |
| GET | `unified_coach_chat/expert_story_detail/` |  | (Lkotlin/coroutines/Continuation<-k>;)Object | c.f |
| GET | `unified_coach_chat/get-channel` |  | ()Lio/reactivex/b0<Lretrofit2/Response<a>;>; | c.b |
| GET | `unified_coach_chat/ria-bubbles` |  | (Lkotlin/coroutines/Continuation<-m>;)Object | c.e |
| POST | `unified_coach_chat/update_group_name` | @Body b | (bLkotlin/coroutines/Continuation<-Unit>;)Object | c.c |
| GET | `upgrade/cards/` |  | ()Lio/reactivex/b0<Lretrofit2/Response<Ljava/util/List<Carousel>;>;>; | g.h |
| POST | `user/action/done/` | @Body c | (c)Lio/reactivex/b0<Lretrofit2/Response<d>;>; | b$a.a |
| POST | `user/action/done/` | @Body l | (lLkotlin/coroutines/Continuation<-Lretrofit2/Response<d>;>;)Object | b$a.b |
| GET | `user/budgets/sync` | @Query(sync_token) J | (J)Lio/reactivex/s<UserBudgetResponse>; | a0.a0 |
| GET | `user/comms/pref` |  | ()Lio/reactivex/b0<CommunicationChannelResponse>; | c.a |
| POST | `user/comms/pref` | @Body CommunicationChannelPostResponse | (CommunicationChannelPostResponse)Lio/reactivex/b0<CommunicationChannelData>; | c.b |
| GET | `user/consultation/flow-info` | @Query(source) String, @Query(pre_auth_key) String, @Query(returning_user_flow) String | gStringLkotlin/coroutines/Continuation<-Lretrofit2/Response<CallSchedulerConfig>;>;)Object | c.c |
| GET | `user/engagement-hook-experiment/final-screen` |  | (Lkotlin/coroutines/Continuation<-Lretrofit2/Response<d>;>;)Object | c.a |
| GET | `user/fallback/consultation-flow` | @Query(source) String | (String)Lio/reactivex/b0<Lretrofit2/Response<OnboardingFlowInfo>;>; | q$a.a |
| GET | `user/features/availabilities` |  | ()Lio/reactivex/s<Lretrofit2/Response<q>;>; | f.a |
| GET | `user/features/availabilities` |  | ()Lio/reactivex/b0<Lretrofit2/Response<q>;>; | f.b |
| POST | `user/free_trial/activate` | @Body FreeTrial | (FreeTrial)Lio/reactivex/b0<Lretrofit2/Response<j>;>; | k.a |
| POST | `user/free_trial/activate` | @Body FreeTrial | (FreeTrial)Lretrofit2/Call<Void>; | k.b |
| POST | `user/free_trial/eligible` | @Body o | a | c.c |
| GET | `user/free_trial/intro_config` |  | ()Lio/reactivex/b0<e>; | c.f |
| GET | `user/inbound-flow` |  | ()Lio/reactivex/b0<f>; | c.a |
| GET | `user/landing-page/info` | @Query(source) String | (StringLkotlin/coroutines/Continuation<-VideoLandingPageResponse>;)Object | a.a |
| GET | `user/locale/info` |  | ()Lio/reactivex/b0<Lretrofit2/Response<UserLocaleApiResponse>;>; | a0.F |
| POST | `user/locale/info` | @Body UserLocalePostData | (UserLocalePostData)Lio/reactivex/b0<Lretrofit2/Response<j>;>; | a0.V |
| PUT | `user/medicine/track` | @Body a | (a)Lio/reactivex/b0<a>; | a.a |
| POST | `user/onboarding/analytics` | @Body i | (i)Lio/reactivex/b0<Lretrofit2/Response<j>;>; | g$a.k |
| GET | `user/onboarding/flow` | @Query(pre_auth_key) String, @Query(store_currency_code) String | (StringString)Lio/reactivex/b0<Lretrofit2/Response<LaunchIntentData>;>; | g$a.a |
| GET | `user/onboarding/flow-info` | @Query(pre_auth_key) String, @Query(returning_user_flow) String | (StringString)Lio/reactivex/b0<Lretrofit2/Response<OnboardingFlowInfo>;>; | q$a.c |
| GET | `user/onboarding/real-time-calling-v3/info` | @Query(pre_auth_key) String, @Query(returning_user_flow) String | (StringString)Lio/reactivex/b0<b>; | c.c |
| GET | `user/onboarding/welcome-back-info` | @Query(user_type) String, @Query(variant) String | (StringStringLkotlin/coroutines/Continuation<-c>;)Object | a.b |
| GET | `user/onboarding/welcome-back-info` | @Query(variant) String | (StringLkotlin/coroutines/Continuation<-Lretrofit2/Response<b>;>;)Object | a.a |
| POST | `user/ping/android/` | @Body PingBody | (PingBody)Lretrofit2/Call<PingResponse>; | a0.r |
| GET | `user/points` |  | ()Lio/reactivex/s<UserPointsResponse>; | a0.N |
| GET | `user/rtc-v3/eligibility/info` | @Query(source) String | (String)Lio/reactivex/b0<b>; | c.b |
| POST | `user/screens/content` | @Body ScreenConfigKeys | (ScreenConfigKeys)Lio/reactivex/b0<ScreenContentResponse>; | a0.c |
| POST | `user/screens/content` | @Body a$b | (a$bLkotlin/coroutines/Continuation<-a>;)Object | a.a |
| POST | `user/screens/content` | @Body a$a | (a$aLkotlin/coroutines/Continuation<-e>;)Object | a.a |
| POST | `user/screens/content` | @Body e | (eLkotlin/coroutines/Continuation<-l>;)Object | d.a |
| POST | `user/screens/content` | @Body ScreenConfigKeys | (ScreenConfigKeys)Lio/reactivex/b0<l>; | b.c |
| GET | `user/sensor/` | @Query(device_type) I | (I)Lio/reactivex/b0<Lretrofit2/Response<c>;>; | b.a |
| GET | `user/sensor/` |  | ()Lio/reactivex/b0<c>; | b.b |
| POST | `user/sensor/` | @Body a | (a)Lio/reactivex/b0<Lretrofit2/Response<j>;>; | b.c |
| GET | `user/welcome_back_booking_consultation` | @Query(user_type) String | (StringLkotlin/coroutines/Continuation<-a>;)Object | a.a |
| GET | `user/{email}/is_premium/` | @Path(email) String | (String)Lio/reactivex/s<Lretrofit2/Response<VerifyPremiumResponse>;>; | g.c |
| POST | `user/{user_name}/bot-conversations/` | @Path(user_name) String, @Body c | (Stringc)Lio/reactivex/b0<Lretrofit2/Response<j>;>; | b.g |
| POST | `user_activity/first/` | @Body UserActvityData | (UserActvityData)Lio/reactivex/s<Lretrofit2/Response<UserActivityLogResponse>;>; | t$a.a |
| POST | `user_attr` | @Body j | a | e.a |
| GET | `user_attr` | @Query(fields) String | (String)Lio/reactivex/b0<Lretrofit2/Response<f>;>; | e.b |
| GET | `user_plan/usage/` |  | ()Lio/reactivex/b0<PlanUsage>; | t.a |
| POST | `user_plan/usage/` | @Body PlanUsage | (PlanUsage)Lio/reactivex/b0<j>; | t.b |
| GET | `user_preferences/flow/{flow_id}/` | @Path(flow_id) I | (I)Lio/reactivex/b0<q>; | g.f |
| GET | `user_preferences/flow_answer_summary` | @Query(flow_ids) List | (Ljava/util/List<Integer>;)Lio/reactivex/b0<FlowSummaryResponse>; | g.c |
| GET | `user_preferences/flow_question_config/{question_info_id}` | @Path(question_info_id) I | (I)Lio/reactivex/b0<r>; | g.b |
| POST | `user_preferences/submit_responses/` | @Body t | a | g.a |
| GET | `user_sync/data` | @Query(table_names) String, @Query(install_id) String, @Query(device_id) String | (StringStringString)Lio/reactivex/b0<Lretrofit2/Response<i>;>; | b$a.a |
| POST | `user_sync/data` | @Body d, @Query(table_names) String, @Query(install_id) String, @Query(device_id) String | (dStringStringString)Lio/reactivex/b0<Lretrofit2/Response<i>;>; | b$a.b |
| GET | `user_sync/data` | @Query(table_names) String, @Query(device_id) String, @Query(install_id) String, @Query(force_sync) Boolean | (StringStringStringBoolean)Lio/reactivex/b0<MealPreferenceSyncResponse>; | MealTypeApiService.syncUserSelectedMealTypes |
| POST | `user_sync/data` | @Body r, @Query(table_names) List, @Query(device_id) String, @Query(install_id) String | (rLjava/util/List<String>;StringStringLkotlin/coroutines/Continuation<-t>;)Object | d.a |
| GET | `user_sync/data` | @Query(table_names) List, @Query(device_id) String, @Query(install_id) String, @Query(sync_mode) String | (Ljava/util/List<String>;StringStringString)Lio/reactivex/b0<q>; | d.b |
| GET | `user_sync/data` | @Query(table_names) List, @Query(device_id) String, @Query(install_id) String, @Query(force_sync) Boolean | (Ljava/util/List<String>;StringStringBoolean)Lio/reactivex/b0<s>; | k.a |
| POST | `user_sync/data` | @Query(table_names) List, @Query(device_id) String, @Query(install_id) String, @Body p | (Ljava/util/List<String>;StringStringpLkotlin/coroutines/Continuation<-i>;)Object | k.b |
| GET | `user_sync/data` | @Query(table_names) String, @Query(install_id) String, @Query(device_id) String, @Query(force_sync) Boolean | (StringStringStringBoolean)Lio/reactivex/b0<Lretrofit2/Response<f>;>; | d$a.a |
| POST | `user_sync/data` | @Body e | a | d$a.b |
| POST | `user_sync/data` | @Body h | (h)Lio/reactivex/b0<j>; | c.c |
| POST | `user_sync/data?table_names=AggrWorkoutLog` | @Query(install_id) String, @Query(device_id) String, @Query(sync_mode) String, @Body a | a | b.b |
| GET | `user_sync/data?table_names=CGMLogs` | @Query(install_id) String, @Query(device_id) String, @Query(force_sync) Boolean, @Query(sync_type) String | (StringStringBooleanString)Lio/reactivex/b0<i>; | c.f |
| POST | `user_sync/data?table_names=CGMOffsets` | @Query(install_id) String, @Query(device_id) String, @Body h | (StringStringhLkotlin/coroutines/Continuation<-i>;)Object | a.a |
| GET | `user_sync/data?table_names=CGMOffsets` | @Query(install_id) String, @Query(device_id) String, @Query(force_sync) Boolean, @Query(sync_type) String | (StringStringBooleanStringLkotlin/coroutines/Continuation<-g>;)Object | a.c |
| POST | `user_sync/data?table_names=RawWaterLog` | @Query(install_id) String, @Query(device_id) String, @Query(sync_mode) String, @Body d | (StringStringStringd)Lio/reactivex/b0<a>; | a.b |
| GET | `user_sync/data?table_names=RawWaterLog` | @Query(install_id) String, @Query(device_id) String | (StringString)Lio/reactivex/b0<a>; | a.c |
| GET | `user_sync/data?table_names=RawWaterLog&force_sync=true&sync_type=reverse` | @Query(install_id) String, @Query(device_id) String | (StringString)Lio/reactivex/b0<a>; | a.a |
| GET | `user_sync/data?table_names=RawWorkoutLog` | @Query(install_id) String, @Query(device_id) String | (StringString)Lio/reactivex/b0<c>; | b.a |
| POST | `user_sync/data?table_names=RawWorkoutLog` | @Query(install_id) String, @Query(device_id) String, @Query(sync_mode) String, @Body f | (StringStringStringf)Lio/reactivex/b0<c>; | b.c |
| GET | `user_sync/data?table_names=RawWorkoutLog&force_sync=true&sync_type=reverse` | @Query(install_id) String, @Query(device_id) String | (StringString)Lio/reactivex/b0<c>; | b.d |
| GET | `users/dashboard/options` | @Query(opened_count) I, @Query(dashboard_refresh) Z | (IZ)Lio/reactivex/b0<Lretrofit2/Response<a>;>; | g.c |
| POST | `users/me/workout_log/workoutlog_sync/` | @Body j | (j)Lretrofit2/Call<j>; | a0.L |
| POST | `users/points_log/sync/` | @Query(format) String, @Body PointsSyncData | (StringPointsSyncData)Lio/reactivex/s<PointsSyncData>; | u.c |
| GET | `users/qualified/bucket` |  | ()Lio/reactivex/b0<Lretrofit2/Response<a>;>; | d.a |
| POST | `verify` | @Header(appKey) String, @Header(fingerPrint) String, @Body VerifyInstallationModel | (StringStringVerifyInstallationModel)Lretrofit2/Call<Ljava/util/Map<StringObject>;>; | d.b |
| POST | `water_goal/set/` | @Body a | a | c0.b |
| POST | `water_tracking/sync/` | @Body WaterLogData | (WaterLogData)Lio/reactivex/s<WaterLogData>; | c0.a |
| GET | `weight/fetch/new` | @Query(sync_token) J | (J)Lio/reactivex/b0<j>; | b.l |
| POST | `weight/image/{year}/{month}/{day}` | @Path(year) I, @Path(month) I, @Path(day) I, @Part MultipartBody$Part | a | b.g |
| GET | `weightgoal/history/` |  | ()Lio/reactivex/b0<[WeightGoal>; | a0.o |
| GET | `whatsapp/consent/` |  | ()Lio/reactivex/b0<Lretrofit2/Response<c>;>; | b.a |
| POST | `whatsapp/consent/` | @Body c | (c)Lio/reactivex/b0<j>; | b.b |
| POST | `whatsapp/consent/` | @Body c | (cLkotlin/coroutines/Continuation<-Unit>;)Object | b.j |
| GET | `workout-sets` |  | ()Lio/reactivex/b0<Lretrofit2/Response<e>;>; | f.c |
| GET | `workout-sets/categorized` |  | ()Lio/reactivex/b0<Lretrofit2/Response<e>;>; | f.b |
| POST | `workout-sets/change` | @Body e | (e)Lio/reactivex/b0<Lretrofit2/Response<j>;>; | c.a |
| GET | `workout-sets/options` | @Query(workout_date) String, @Query(force_refresh) Boolean, @Query(future) Boolean | (StringBooleanBoolean)Lio/reactivex/b0<Lretrofit2/Response<d>;>; | c.b |
| GET | `workout-sets/questionnaire` |  | ()Lio/reactivex/b0<Ljava/util/List<Question>;>; | f.a |
| GET | `workout-sets/recommended-categories` |  | ()Lio/reactivex/b0<Lretrofit2/Response<a>;>; | a.a |
| POST | `workout-sets/save-preference` | @Body l | (l)Lio/reactivex/b0<Lretrofit2/Response<j>;>; | f.b |
| GET | `workout-sets/user-pref/explainer` |  | ()Lio/reactivex/b0<Lretrofit2/Response<e>;>; | c.a |
| GET | `workout-sets/{workout_set_id}` | @Path(workout_set_id) I | (I)Lio/reactivex/b0<Lretrofit2/Response<f>;>; | f.a |
| GET | `workout/plan/user/{user_id}/note/` | @Path(user_id) I | (I)Lio/reactivex/b0<Lretrofit2/Response<PlanNotes>;>; | b.b |
| GET | `workout_plan/day/{day_value}/plan?video_format=webm` | @Path(day_value) I | (I)Lio/reactivex/b0<d>; | c.b |
| GET | `workout_preference_client/user-preference` |  | ()Lio/reactivex/b0<UserWorkoutPreferenceModel>; | r.c |
| POST | `workout_preference_client/user-preference` | @Body SaveUserPreferenceModel | a | r.d |
| GET | `workout_preference_client/user-preference-questions` |  | ()Lio/reactivex/b0<s>; | r.b |
| GET | `workoutautocomplete/search` | @Query(search_term) String, @Query(level) String, @Query(category) String | (StringStringString)Lio/reactivex/b0<Lretrofit2/Response<g>;>; | a.b |
| GET | `workouts/data` | @Query(workout_db_id) J | (J)Lio/reactivex/b0<Lretrofit2/Response<h>;>; | d.b |
| GET | `workouts/data/sync` | @QueryMap Map | (Ljava/util/Map<StringObject>;)Lio/reactivex/b0<Lretrofit2/Response<d>;>; | d.a |
