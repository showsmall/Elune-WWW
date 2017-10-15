import { observable, action, computed } from "mobx";
import { FetchTopic } from "api/Topic";
import { FetchTopicPosts } from "api/Post";
import Topic from "model/Topic";
import Post from "model/Post";
import IStoreArgument from "interface/IStoreArgument";
import { SortOrder, SortOrderBy } from "enum/Sort";
import { EditorSuggestion } from "interface/EditorSuggestion";
import AbstractStore from "./AbstractStore";
import { IS_NODE } from "../../../env";

declare var window;

/**
 * Topic详情页Store(单例)
 */
export default class TopicStore extends AbstractStore {
    private static instance: TopicStore;

    public static get Instance() {
        return TopicStore.getInstance({} as any);
    }

    /**
     * @param arg SSR环境下组件生命周期之前实例化store, 见ssr/render.ts
     */
    public static getInstance(arg: IStoreArgument = {} as IStoreArgument) {
        if (!TopicStore.instance) {
            TopicStore.instance = new TopicStore(arg);
        }
        return TopicStore.instance;
    }

    public static rebuild(arg: IStoreArgument = {} as IStoreArgument) {
        const instance = TopicStore.getInstance(arg);
        instance.reset(arg);
        instance.loading = true;
        instance.topic = null as any;
        instance.fetchData();
        return instance;
    }

    private constructor(arg: IStoreArgument) {
        super(arg);

        if (!IS_NODE) {
            // 浏览器端从全局InitialState中初始化Store
            const initialState = window.__INITIAL_STATE__ || {};
            if (initialState && initialState.TopicStore) {
                this.fromJSON(initialState.TopicStore);
            } else {
                this.fetchData();
            }
        }
    }

    public destroy() {
        TopicStore.instance = null as any;
    }

    @action
    setField = (field: string, value: any) => {
        this[field] = value;
    };

    @observable loading: boolean = false;

    /**
     * 所有频道列表
     */
    @observable topic: Topic = null as any;

    @action
    setTopic = (topic: Topic) => {
        this.topic = topic;
    };

    @action
    getTopic = () => {
        if (this.loading) {
            return Promise.reject(false);
        }
        const { id } = this.Match.params;
        this.loading = true;
        return FetchTopic({ id: Number(id) }).then(resp => {
            this.setTopic(resp);
            this.loading = false;
        });
    };

    @observable postsLoading: boolean = false;
    @observable postPage: number = 1;
    @observable postPageSize: number = 20;
    @observable order: SortOrder = SortOrder.DESC;
    @observable orderBy: SortOrderBy = SortOrderBy.ID;

    @observable posts: Post[] = [];

    @observable postTotal: number = -1;

    @computed
    get mentions() {
        const { topic, posts, editingPostMentions } = this;
        let mentions: EditorSuggestion[] = [];
        const mentionValues = editingPostMentions.map(x => x.value);
        const includeReply = mentionValues.some(x => /(.+)(#[0-9]+)$/.test(x));
        !includeReply &&
            mentions.push({
                text: `${topic.author.nickname} 回复#0 - ${topic.content}`,
                value: `${topic.authorName}#0`,
                url: "#thread"
            });
        mentionValues.indexOf(topic.authorName) < 0 &&
            mentions.push({
                text: topic.author.nickname,
                value: `${topic.authorName}`,
                url: "javascript:;"
            });

        const postsMap = {};
        posts.forEach(post => {
            if (!postsMap[post.authorId]) {
                postsMap[post.authorId] = [post];
            } else {
                postsMap[post.authorId].push(post);
            }
        });

        Object.keys(postsMap).forEach(authorId => {
            postsMap[authorId].forEach(post => {
                !includeReply &&
                    mentions.push({
                        text: `${post.author
                            .nickname} 回复#${post.id} - ${post.content.substr(
                            0,
                            20
                        )}`,
                        value: `${post.authorName}#${post.id}`,
                        url: `#post-${post.id}`
                    });
            });
            mentionValues.indexOf(postsMap[authorId][0].authorName) < 0 &&
                mentions.push({
                    text: postsMap[authorId][0].author.nickname,
                    value: `${postsMap[authorId][0].authorName}`,
                    url: "javascript:;"
                });
        });

        return mentions;
    }

    @computed
    get hasMorePosts() {
        const { postPage, postPageSize, postTotal } = this;
        return postTotal === -1 || postPage * postPageSize < postTotal;
    }

    @action
    setPosts = (posts: Post[]) => {
        this.posts = posts;
    };

    @action
    getPosts = (keepExist: boolean = false) => {
        const { postPage, postPageSize, posts, order, orderBy } = this;
        const { id } = this.Match.params;
        const params = {
            page: postPage,
            pageSize: postPageSize,
            order,
            orderBy,
            topicId: Number(id)
        };
        this.setField("postsLoading", true);
        return FetchTopicPosts(params)
            .then(resp => {
                this.setPosts(
                    keepExist ? posts.concat(resp.items) : resp.items
                );
                this.setField("postsLoading", false);
                if (postPage === 1) {
                    this.setField("total", resp.total);
                }
                return resp;
            })
            .catch(() => {
                this.setField("topicsLoading", false);
            });
    };

    @action
    getNextPageTopics = () => {
        const { postPage, postPageSize, postTotal } = this;
        if ((postPage - 1) * postPageSize >= postTotal) {
            return;
        }
        this.setField("postPage", postPage + 1);
        this.getPosts(true);
    };

    @action
    refreshPosts = () => {
        this.setPosts([]);
        this.setField("postPage", 1);
        this.setField("postTotal", 0);
        this.getPosts();
    };

    // 正在编辑的评论/回复
    @observable editingPostRaw: string = "";
    @observable editingPostHtml: string = "";
    @observable editingPostText: string = "";
    @observable editingPostMentions: EditorSuggestion[] = [];
    @computed
    get postBtnDisabled() {
        return this.editingPostText.length < 1;
    }

    @action
    goComment = () => {
        const { topic } = this;
        const value = `${topic.authorName}#0`;
        const raw = `{"entityMap":{"0":{"type":"MENTION","mutability":"IMMUTABLE","data":{"text":"@${value}","value":"${value}","url":"#thread"}}},"blocks":[{"key":"ob2h","text":"@${value} ","type":"unstyled","depth":0,"inlineStyleRanges":[],"entityRanges":[{"offset":0,"length":${value.length +
            1},"key":0}],"data":{}}]}`;
        const html = `<p><a href="#thread" class="wysiwyg-mention" data-mention data-value="${value}">@${value}</a>&nbsp;</p>`;
        this.editingPostRaw = raw;
        this.editingPostHtml = html;
        this.editingPostText = `@${value}`;
        this.editingPostMentions = [
            {
                text: `@${value}`,
                value,
                url: "#thread"
            }
        ];
    };

    @action
    editPost = (
        raw: string,
        html: string,
        text: string,
        mentions: EditorSuggestion[]
    ) => {
        this.editingPostRaw = raw;
        this.editingPostHtml = html;
        this.editingPostText = text;
        this.editingPostMentions = mentions;
    };

    /**
     * SSR数据初始化(必须返回promise)
     */
    fetchData() {
        const promises: Promise<any>[] = [];
        promises.push(this.getTopic());
        promises.push(this.getPosts());
        return Promise.all(promises);
    }

    public toJSON() {
        const obj = super.toJSON();
        return Object.assign(obj, {
            topic: this.topic,
            posts: this.posts,
            postTotal: this.postTotal
        });
    }

    public fromJSON(json: any) {
        super.fromJSON(json);
        if (!json) {
            return this;
        }
        const { topic, posts, postTotal } = json;
        if (typeof topic !== "undefined") {
            this.setTopic(topic);
        }
        if (typeof posts !== "undefined") {
            this.setPosts(posts);
        }
        this.setField("postTotal", postTotal);
        return this;
    }
}
