import React, { lazy, useEffect, useState } from 'react';
import getFileContents from '@/api/server/files/getFileContents';
import { httpErrorToHuman } from '@/api/http';
import SpinnerOverlay from '@/components/elements/SpinnerOverlay';
import saveFileContents from '@/api/server/files/saveFileContents';
import FileManagerBreadcrumbs from '@/components/server/files/FileManagerBreadcrumbs';
import { useHistory, useLocation, useParams } from 'react-router';
import FileNameModal from '@/components/server/files/FileNameModal';
import Can from '@/components/elements/Can';
import FlashMessageRender from '@/components/FlashMessageRender';
import PageContentBlock from '@/components/elements/PageContentBlock';
import ServerError from '@/components/screens/ServerError';
import tw from 'twin.macro';
import Button from '@/components/elements/Button';
import Select from '@/components/elements/Select';
import modes from '@/modes';
import useFlash from '@/plugins/useFlash';
import { ServerContext } from '@/state/server';

const LazyAceEditor = lazy(() => import(/* webpackChunkName: "editor" */'@/components/elements/AceEditor'));

export default () => {
    const [ error, setError ] = useState('');
    const { action } = useParams();
    const [ loading, setLoading ] = useState(action === 'edit');
    const [ content, setContent ] = useState('');
    const [ modalVisible, setModalVisible ] = useState(false);
    const [ mode, setMode ] = useState('plain_text');

    const history = useHistory();
    const { hash } = useLocation();

    const id = ServerContext.useStoreState(state => state.server.data!.id);
    const uuid = ServerContext.useStoreState(state => state.server.data!.uuid);
    const { addError, clearFlashes } = useFlash();

    let fetchFileContent: null | (() => Promise<string>) = null;

    useEffect(() => {
        if (action === 'new') return;

        setLoading(true);
        setError('');
        getFileContents(uuid, hash.replace(/^#/, ''))
            .then(setContent)
            .catch(error => {
                console.error(error);
                setError(httpErrorToHuman(error));
            })
            .then(() => setLoading(false));
    }, [ action, uuid, hash ]);

    const save = (name?: string) => {
        if (!fetchFileContent) {
            return;
        }

        setLoading(true);
        clearFlashes('files:view');
        fetchFileContent()
            .then(content => {
                return saveFileContents(uuid, name || hash.replace(/^#/, ''), content);
            })
            .then(() => {
                if (name) {
                    history.push(`/server/${id}/files/edit#/${name}`);
                    return;
                }

                return Promise.resolve();
            })
            .catch(error => {
                console.error(error);
                addError({ message: httpErrorToHuman(error), key: 'files:view' });
            })
            .then(() => setLoading(false));
    };

    if (error) {
        return (
            <ServerError message={error} onBack={() => history.goBack()}/>
        );
    }

    return (
        <PageContentBlock>
            <FlashMessageRender byKey={'files:view'} css={tw`mb-4`}/>
            <FileManagerBreadcrumbs withinFileEditor isNewFile={action !== 'edit'}/>
            {hash.replace(/^#/, '').endsWith('.pteroignore') &&
            <div css={tw`mb-4 p-4 border-l-4 bg-neutral-900 rounded border-cyan-400`}>
                <p css={tw`text-neutral-300 text-sm`}>
                    You&apos;re editing
                    a <code css={tw`font-mono bg-black rounded py-px px-1`}>.pteroignore</code> file.
                    Any files or directories listed in here will be excluded from backups. Wildcards are supported by
                    using an asterisk (<code css={tw`font-mono bg-black rounded py-px px-1`}>*</code>). You can
                    negate a prior rule by prepending an exclamation point
                    (<code css={tw`font-mono bg-black rounded py-px px-1`}>!</code>).
                </p>
            </div>
            }
            <FileNameModal
                visible={modalVisible}
                onDismissed={() => setModalVisible(false)}
                onFileNamed={(name) => {
                    setModalVisible(false);
                    save(name);
                }}
            />
            <div css={tw`relative`}>
                <SpinnerOverlay visible={loading}/>
                <LazyAceEditor
                    mode={mode}
                    filename={hash.replace(/^#/, '')}
                    onModeChanged={setMode}
                    initialContent={content}
                    fetchContent={value => {
                        fetchFileContent = value;
                    }}
                    onContentSaved={save}
                />
            </div>
            <div css={tw`flex justify-end mt-4`}>
                <div css={tw`rounded bg-neutral-900 mr-4`}>
                    <Select value={mode} onChange={e => setMode(e.currentTarget.value)}>
                        {Object.keys(modes).map(key => (
                            <option key={key} value={key}>{modes[key]}</option>
                        ))}
                    </Select>
                </div>
                {action === 'edit' ?
                    <Can action={'file.update'}>
                        <Button onClick={() => save()}>
                            Save Content
                        </Button>
                    </Can>
                    :
                    <Can action={'file.create'}>
                        <Button onClick={() => setModalVisible(true)}>
                            Create File
                        </Button>
                    </Can>
                }
            </div>
        </PageContentBlock>
    );
};
