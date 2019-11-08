"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const ISSUES_START_TAG = '<issues>';
const ISSUES_END_TAG = '</issues>';
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const token = core.getInput('GITHUB_TOKEN', { required: true });
            const modifyDescription = core.getInput('MODIFY_DESCRIPTION', {
                required: false,
            });
            const prInfo = yield getPRInfo();
            if (!prInfo) {
                console.log('Could not get the branch name from context, exiting');
                return;
            }
            // first we look at the branch name...
            const { branch, prNumber, commits } = prInfo;
            const issueNumbers = [];
            const branchIssueNumber = extractIssueNumber(branch);
            if (branchIssueNumber) {
                issueNumbers.push(branchIssueNumber);
            }
            // then we look at the commits...
            if (commits) {
                for (const commitRelation of commits) {
                    const message = commitRelation.commit.message;
                    const commitIssueNumber = extractIssueNumber(message);
                    if (commitIssueNumber) {
                        issueNumbers.push(commitIssueNumber);
                    }
                }
            }
            if (issueNumbers.length === 0) {
                console.log(`Could not get the issueNumber from branch name ${branch} or related commits, exiting`);
                return;
            }
            const uniqueIssueNumbers = Array.from(new Set(issueNumbers));
            const text = `This PR closes #${uniqueIssueNumbers.join(', closes #')}.`;
            const client = new github.GitHub(token);
            if (modifyDescription) {
                let body = github.context.payload.pull_request.body || '';
                body = body.replace(new RegExp(`\\n\\n${ISSUES_START_TAG}[\\w\\W\\s\\S]*${ISSUES_END_TAG}`, 'g'), '');
                body += '\n\n' + ISSUES_START_TAG + text + ISSUES_END_TAG;
                yield client.pulls.update({
                    repo: github.context.payload.repository.name,
                    owner: github.context.payload.repository.owner.login,
                    pull_number: github.context.payload.pull_request.number,
                    body: body,
                });
            }
            else {
                yield createComment(client, prNumber, text);
            }
        }
        catch (error) {
            core.error(error);
            core.setFailed(error.message);
        }
    });
}
function extractIssueNumber(str) {
    for (const part of str.split(/[-:_\W#\/]+/g)) {
        const maybeIssueNumber = parseInt(part);
        if (maybeIssueNumber) {
            return maybeIssueNumber;
        }
    }
}
function getPRInfo() {
    return __awaiter(this, void 0, void 0, function* () {
        const payload = github.context.payload;
        console.log(JSON.stringify(github.context.payload, undefined, 2));
        const pr = payload.pull_request;
        if (!pr) {
            return;
        }
        const token = core.getInput('GITHUB_TOKEN', { required: true });
        const client = new github.GitHub(token);
        const commits = yield client.pulls.listCommits({
            pull_number: pr.number,
            owner: pr.base.repo.owner.login,
            repo: pr.base.repo.name,
            per_page: 100,
        });
        return {
            branch: pr.head.ref,
            prNumber: pr.node_id,
            commits: commits.data,
        };
    });
}
function createComment(client, prNodeId, body) {
    return __awaiter(this, void 0, void 0, function* () {
        yield client.graphql(`mutation AddComment($input: AddCommentInput!) {
      addComment(input:$input) {
        clientMutationId
      }
    }
    `, {
            input: {
                subjectId: prNodeId,
                body,
            },
        });
    });
}
run();
